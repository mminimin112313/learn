// main.js - 앱의 핵심 초기화 및 전역 상태 관리
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { collection, doc, getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // getFirestore, collection, doc 임포트

import { FIREBASE_CONFIG, DEFAULT_ACTIONS, MASTER_PROMPT_SHELL } from './constants.js';
import { showToast, copyToClipboard, readFileAsText, showConfirmationModal } from './utils.js'; // showConfirmationModal 임포트
import { initAuth, signInWithGoogle, signOutUser } from './auth.js';
import { initFirestore, loadUserProjectsFromFirestore, saveProjectToFirestore, deleteProjectFromFirestore, updateModuleField } from './db.js';
import { 
    render, renderProjectList, renderWorkspace, renderResourceList, renderLearningDashboard, 
    renderActionSelector, renderActionManager, openStudyPadViewer, toggleStudyPadViewerMode, 
    saveStudyPadViewerContent, openDetailViewer 
} 
from './ui.js';
import { 
    handleNewProjectClick, handleSaveProjectClick, handleImportProjectFile, handleExportProjectClick, 
    handleAddResourceClick, handleResourceFileChange, handleSaveResourceClick, handleApplyPlanClick, 
    handleManageActionsClick, openActionEditor, saveAction, deleteAction, downloadAllStudyPads, 
    handleExecutePromptClick, toggleSidebar
} from './modals.js';
import { handleBuildPrompt } from './promptBuilder.js';


// --- App State ---
export const App = {
    db: { projects: {}, activeProjectId: null, currentUser: null }, 
    bs: {}, // Bootstrap Modal 인스턴스 저장
    dom: {}, // 캐시된 DOM 요소 저장
    state: { saveTimeout: null, currentModuleIndexForViewer: null, scrollPositions: {} },
    // 모듈화된 함수들을 App 객체에 바인딩하여 전역적으로 접근 가능하게 함
    showToast: showToast,
    copyToClipboard: copyToClipboard,
    readFileAsText: readFileAsText,
    showConfirmationModal: showConfirmationModal, // 전역으로 사용 가능하게 바인딩
    saveProjectToFirestore: saveProjectToFirestore,
    deleteProjectFromFirestore: deleteProjectFromFirestore,
    updateModuleField: updateModuleField,
    render: render,
    renderProjectList: renderProjectList,
    renderWorkspace: renderWorkspace,
    renderResourceList: renderResourceList,
    renderLearningDashboard: renderLearningDashboard,
    renderActionSelector: renderActionSelector,
    renderActionManager: renderActionManager,
    openStudyPadViewer: openStudyPadViewer,
    toggleStudyPadViewerMode: toggleStudyPadViewerMode,
    saveStudyPadViewerContent: saveStudyPadViewerContent,
    openDetailViewer: openDetailViewer,
    handleBuildPrompt: handleBuildPrompt, // promptBuilder에서 가져온 함수
    DEFAULT_ACTIONS_CONST: DEFAULT_ACTIONS, // constants.js에서 가져온 상수
    MASTER_PROMPT_SHELL_CONST: MASTER_PROMPT_SHELL, // constants.js에서 가져온 상수
    saveDb: saveDb, // 로컬 UI 상태 저장을 위한 함수
    switchActiveProject: switchActiveProject // 프로젝트 전환 함수
};

// --- 1. Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    cacheDOMElements();
    initBootstrap();
    loadDb(); // Load local UI state and activeProjectId

    // Initialize Firebase services
    const firebaseApp = initializeApp(FIREBASE_CONFIG);
    // const analytics = getAnalytics(firebaseApp); // Analytics는 필수가 아니라 주석 처리
    initAuth(firebaseApp); // Auth 초기화 및 onAuthStateChanged 리스너 등록
    initFirestore(firebaseApp); // Firestore 초기화

    registerEventListeners();
    console.log("ILE App v8.5 Initialized");
}

function cacheDOMElements() {
    App.dom.sidebar = document.getElementById('sidebar');
    App.dom.overlay = document.getElementById('overlay');
    App.dom.projectList = document.getElementById('project-list');
    App.dom.resourceList = document.getElementById('resource-list');
    App.dom.welcomeScreen = document.getElementById('welcome-screen');
    App.dom.projectWorkspace = document.getElementById('project-workspace');
    App.dom.learningDashboard = document.getElementById('learning-dashboard');
    App.dom.planInput = document.getElementById('plan-input');
    App.dom.projectTitleMain = document.getElementById('project-title-main');
    App.dom.projectTitleMobile = document.getElementById('project-title-mobile');
    App.dom.projectGoal = document.getElementById('project-goal');
    App.dom.planButton = document.getElementById('plan-button'); 
    App.dom.actionListContainer = document.getElementById('action-list-container');
    App.dom.actionSelectorBody = document.getElementById('action-selector-body');
    App.dom.promptModalLabel = document.getElementById('promptModalLabel');
    App.dom.dynamicFormContainer = document.getElementById('dynamic-form-container');
    App.dom.dataSelector = document.getElementById('data-selector');
    App.dom.livePreviewContainer = document.getElementById('live-preview-container');
    App.dom.studyPadViewerModal = document.getElementById('studyPadViewerModal');
    App.dom.studyPadViewerContent = document.getElementById('study-pad-viewer-content');
    App.dom.studyPadEditorContent = document.getElementById('study-pad-editor-content');
    App.dom.studyPadViewerTitle = document.getElementById('studyPadViewerTitle');
    App.dom.toggleViewerModeBtn = document.getElementById('toggle-viewer-mode-btn');
    App.dom.saveViewerContentBtn = document.getElementById('save-viewer-content-btn');

    // For learning progress visualization
    App.dom.overallProgressBar = document.getElementById('overall-progress-bar');
    App.dom.completedModulesCount = document.getElementById('completed-modules-count');
    App.dom.inprogressModulesCount = document.getElementById('inprogress-modules-count');
    App.dom.pendingModulesCount = document.getElementById('pending-modules-count');
    App.dom.moduleStatusChart = document.getElementById('module-status-chart');
    App.chart = null; // To hold the Chart.js instance

    // New elements for authentication
    App.dom.authStatus = document.getElementById('auth-status');
    App.dom.googleSigninBtn = document.getElementById('google-signin-btn');
    App.dom.signOutBtn = document.getElementById('signout-btn');

    // New elements for detail viewer modal
    App.dom.detailViewerModal = document.getElementById('detailViewerModal');
    App.dom.detailViewerTitle = document.getElementById('detailViewerTitle');
    App.dom.detailViewerBody = document.getElementById('detailViewerBody');

    // Empty State Elements
    App.dom.projectListEmptyState = document.getElementById('project-list-empty-state');
    App.dom.resourceListEmptyState = document.getElementById('resource-list-empty-state');
    App.dom.learningDashboardEmptyState = document.getElementById('learning-dashboard-empty-state');
    App.dom.emptyStateNewProjectBtn = document.getElementById('empty-state-new-project-btn'); // New button for empty state
}

function initBootstrap() {
    App.bs.toast = new bootstrap.Toast(document.getElementById('liveToast'));
    App.bs.resourceModal = new bootstrap.Modal(document.getElementById('resourceModal'));
    App.bs.promptModal = new bootstrap.Modal(document.getElementById('promptModal'));
    App.bs.actionManagerModal = new bootstrap.Modal(document.getElementById('actionManagerModal'));
    App.bs.actionEditorModal = new bootstrap.Modal(document.getElementById('actionEditorModal'));
    App.bs.actionSelectorModal = new bootstrap.Modal(document.getElementById('actionSelectorModal'));
    App.bs.newProjectModal = new bootstrap.Modal(document.getElementById('newProjectModal'));
    App.bs.studyPadViewerModal = new bootstrap.Modal(App.dom.studyPadViewerModal);
    App.bs.detailViewerModal = new bootstrap.Modal(App.dom.detailViewerModal);
    // New confirmation modal
    App.bs.confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
}

// 로컬 UI 상태 저장 함수
function saveDb() {
    try {
        const localData = {
            activeProjectId: App.db.activeProjectId,
            scrollPositions: App.state.scrollPositions
        };
        localStorage.setItem('ile_local_ui_state', JSON.stringify(localData));
    } catch (e) {
        console.error("로컬 UI 상태 저장 실패:", e);
        App.showToast("오류", "로컬 설정 저장에 실패했습니다.", "danger");
    }
}

// 로컬 UI 상태 로드 함수
function loadDb() {
    try {
        const stored = localStorage.getItem('ile_local_ui_state');
        if (stored) {
            const localData = JSON.parse(stored);
            App.db.activeProjectId = localData.activeProjectId || null;
            App.state.scrollPositions = localData.scrollPositions || {};
        }
    } catch (e) {
        console.error("로컬 UI 상태 불러오기 실패:", e);
        App.db.activeProjectId = null;
        App.state.scrollPositions = {};
        App.showToast("경고", "로컬 설정을 불러오는 중 오류가 발생하여 초기화합니다.", "warning");
    }
}

// 프로젝트 전환 함수
function switchActiveProject(projectId) {
    App.db.activeProjectId = projectId;
    App.saveDb();
    App.render();
    App.dom.sidebar?.classList.remove('is-open');
    App.dom.overlay?.classList.remove('is-visible');
}

// --- 5. Event Listeners & Handlers ---
function registerEventListeners() {
    // Static buttons
    App.dom.googleSigninBtn?.addEventListener('click', signInWithGoogle);
    App.dom.signOutBtn?.addEventListener('click', signOutUser);

    document.getElementById('new-project-btn')?.addEventListener('click', handleNewProjectClick);
    document.getElementById('save-project-btn')?.addEventListener('click', handleSaveProjectClick);
    document.getElementById('import-project-btn')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
    document.getElementById('import-file-input')?.addEventListener('change', handleImportProjectFile);
    document.getElementById('export-project-btn')?.addEventListener('click', handleExportProjectClick);
    document.getElementById('add-resource-btn')?.addEventListener('click', handleAddResourceClick);
    document.getElementById('save-resource-btn')?.addEventListener('click', handleSaveResourceClick);
    document.getElementById('resource-file-input')?.addEventListener('change', handleResourceFileChange);
    document.getElementById('apply-plan-btn')?.addEventListener('click', handleApplyPlanClick);
    document.getElementById('manage-actions-btn')?.addEventListener('click', handleManageActionsClick);
    document.getElementById('add-new-action-btn')?.addEventListener('click', () => openActionEditor());
    document.getElementById('save-action-btn')?.addEventListener('click', saveAction);
    document.getElementById('execute-prompt-btn')?.addEventListener('click', handleExecutePromptClick);
    document.getElementById('download-studypad-btn')?.addEventListener('click', downloadAllStudyPads);
    
    App.dom.planButton?.addEventListener('click', () => handleBuildPrompt('0_plan', null));
    App.dom.emptyStateNewProjectBtn?.addEventListener('click', handleNewProjectClick); // Empty state button

    // Event Listeners for new Study Pad Viewer buttons
    App.dom.toggleViewerModeBtn?.addEventListener('click', toggleStudyPadViewerMode);
    App.dom.saveViewerContentBtn?.addEventListener('click', saveStudyPadViewerContent);


    // Event Delegation for dynamic content
    App.dom.projectList?.addEventListener('click', handleProjectListClick);
    App.dom.resourceList?.addEventListener('click', handleResourceListClick);
    App.dom.learningDashboard?.addEventListener('click', handleDashboardClick);
    App.dom.learningDashboard?.addEventListener('input', handleDashboardInput);
    App.dom.actionListContainer?.addEventListener('click', handleActionManagerClick);
    App.dom.actionSelectorBody?.addEventListener('click', handleActionSelectorClick);

    // Mobile UI
    document.getElementById('hamburger-btn')?.addEventListener('click', toggleSidebar);
    App.dom.overlay?.addEventListener('click', toggleSidebar);
}

// Specific Click Handlers for Event Delegation
function handleProjectListClick(e) {
    const listItem = e.target.closest('.list-group-item');
    if (!listItem) return;
    const projectId = listItem.dataset.projectId;
    if (e.target.closest('.delete-btn')) {
        e.preventDefault();
        // Custom confirmation modal implementation
        App.showConfirmationModal(`'${App.db.projects[projectId]?.name || "이"}' 프로젝트를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`, async (confirmed) => {
            if (confirmed) {
                App.deleteProjectFromFirestore(projectId).then(success => {
                    if (success) {
                        delete App.db.projects[projectId];
                        if (App.db.activeProjectId === projectId) {
                            App.db.activeProjectId = Object.keys(App.db.projects)[0] || null;
                        }
                        App.saveDb();
                        App.render();
                        App.showToast("성공", "프로젝트가 삭제되었습니다.", "success");
                    }
                });
            }
        });
    } else {
        App.switchActiveProject(projectId);
    }
}

function handleResourceListClick(e) {
    const listItem = e.target.closest('.list-group-item[data-resource-id]');
    if (!listItem) return;
    const resourceId = listItem.dataset.resourceId;
    const project = App.db.projects[App.db.activeProjectId];
    if (!project) return;
    if (e.target.closest('.delete-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const resourceName = project.resources.find(r => r.id === resourceId)?.name || "이";
        // Custom confirmation modal implementation
        App.showConfirmationModal(`'${resourceName}' 자원을 삭제하시겠습니까?`, async (confirmed) => { 
            if (confirmed) {
                project.resources = project.resources.filter(r => r.id !== resourceId);
                App.saveProjectToFirestore(project).then(success => { 
                    if (success) {
                        App.renderResourceList();
                        App.showToast("성공", "자원이 삭제되었습니다.", "success");
                    }
                });
            }
        });
    } else {
        const resource = project.resources.find(r => r.id === resourceId);
        if (resource) {
            document.getElementById('resourceModalTitle').textContent = '자원 편집';
            document.getElementById('resource-id').value = resource.id;
            document.getElementById('resource-name').value = resource.name;
            document.getElementById('resource-content').value = resource.content;
            document.getElementById('resource-file-input').value = '';
            App.bs.resourceModal.show();
        }
    }
}

function handleDashboardClick(e) {
    const target = e.target;
    const card = target.closest('.module-card');
    if (!card) return;
    const moduleIndex = parseInt(card.dataset.moduleIndex, 10);
    if (target.matches('.open-action-selector')) {
        App.renderActionSelector(moduleIndex);
    } else if (target.closest('.status-change-btn')) {
        e.preventDefault();
        App.updateModuleField(moduleIndex, 'status', target.closest('.status-change-btn').dataset.status);
    } else if (target.matches('.view-studypad-btn')) {
        e.preventDefault();
        App.openStudyPadViewer(moduleIndex);
    } else if (target.matches('.view-details-btn')) {
        e.preventDefault();
        const type = target.dataset.detailType;
        App.openDetailViewer(moduleIndex, type);
    }
}

function handleDashboardInput(e) {
    const target = e.target;
    const card = target.closest('.module-card');
    if (!card) return;
    const index = parseInt(card.dataset.moduleIndex, 10);
    if (target.matches('.module-studypad')) {
        App.updateModuleField(index, 'studyPad', target.value);
    } else if (target.matches('.module-notes')) {
        App.updateModuleField(index, 'notes', target.value);
    }
}

function handleActionManagerClick(e) {
    const editBtn = e.target.closest('.edit-action-btn');
    if(editBtn) openActionEditor(editBtn.dataset.actionKey);
    
    const deleteBtn = e.target.closest('.delete-action-btn');
    if(deleteBtn) deleteAction(deleteBtn.dataset.actionKey);
}

function handleActionSelectorClick(e) {
    const buildBtn = e.target.closest('.build-prompt-btn');
    if (buildBtn) {
        e.preventDefault();
        const { templateKey, moduleIndex } = buildBtn.dataset;
        App.handleBuildPrompt(templateKey, parseInt(moduleIndex, 10));
    }
}
