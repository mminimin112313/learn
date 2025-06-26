// modals.js
import { App } from './main.js';
import { showToast, readFileAsText, showConfirmationModal } from './utils.js'; // showConfirmationModal 임포트
import { saveProjectToFirestore } from './db.js';
import { renderProjectList, renderResourceList, renderActionManager, render } from './ui.js';
import { DEFAULT_ACTIONS } from './constants.js';

// 새 프로젝트 모달 열기 핸들러
export function handleNewProjectClick() {
    document.getElementById('new-project-form').reset();
    App.bs.newProjectModal.show();
}

// 새 프로젝트 저장 핸들러
export function handleSaveProjectClick() {
    const nameInput = document.getElementById('new-project-name');
    const goalInput = document.getElementById('new-project-goal');
    if (nameInput.value.trim() && goalInput.value.trim()) {
        createNewProject(nameInput.value, goalInput.value);
        App.bs.newProjectModal.hide();
    } else {
        showToast('오류', '프로젝트 이름과 목표를 모두 입력해야 합니다.', 'danger');
    }
}

// 프로젝트 생성 로직 (App.db, App.saveDb, render 사용)
async function createNewProject(name, goal) {
    if (!App.db.currentUser?.uid) {
        showToast("오류", "먼저 로그인해주세요.", "danger");
        return;
    }
    // Firestore doc ID를 미리 생성하여 프로젝트 ID로 사용
    // firebase.firestore() 대신 getFirestore에서 collection, doc을 가져와 사용
    const projectId = doc(collection(getFirestore(), `users/${App.db.currentUser.uid}/projects`)).id; 
    const newProject = {
        id: projectId,
        name,
        goal,
        resources: [],
        learningPlan: null,
        actions: JSON.parse(JSON.stringify(DEFAULT_ACTIONS)) // Deep copy default actions
    };
    const success = await saveProjectToFirestore(newProject);
    if (success) {
        App.db.projects[projectId] = newProject; // Add to local state after successful Firestore save
        App.switchActiveProject(projectId);
        showToast("성공", `'${name}' 프로젝트가 생성되었습니다.`, "success");
    }
}

// 프로젝트 파일 가져오기 핸들러
export async function handleImportProjectFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!App.db.currentUser?.uid) return showToast("오류", "로그인이 필요합니다.", "danger");

    try {
        const jsonText = await readFileAsText(file);
        const importedProject = JSON.parse(jsonText);
        if (importedProject.id && importedProject.name) {
            // Overwrite local project if exists, otherwise add new
            App.db.projects[importedProject.id] = importedProject;
            // Ensure actions array is initialized or merged with default actions
            if (!importedProject.actions || importedProject.actions.length === 0) {
                importedProject.actions = JSON.parse(JSON.stringify(DEFAULT_ACTIONS));
            } else {
                DEFAULT_ACTIONS.forEach(defaultAction => {
                    if (!importedProject.actions.some(a => a.key === defaultAction.key)) {
                        importedProject.actions.push(defaultAction);
                    }
                });
            }
            const success = await saveProjectToFirestore(importedProject);
            if (success) {
                App.switchActiveProject(importedProject.id);
                showToast("성공", "프로젝트를 성공적으로 가져왔습니다.", "success");
            }
        } else { throw new Error("파일에 'id'와 'name' 속성이 없습니다."); }
    }
    catch (err) {
        let errorMessage = "유효하지 않은 프로젝트 파일이거나 파일 읽기에 실패했습니다.";
        if (err instanceof SyntaxError) {
            errorMessage = "JSON 형식이 올바르지 않습니다. 파일을 확인해주세요.";
        } else if (err.message) {
            errorMessage = err.message;
        }
        showToast("오류", errorMessage, "danger");
    }
    e.target.value = '';
}

// 프로젝트 내보내기 핸들러
export function handleExportProjectClick() {
    if (!App.db.activeProjectId) return showToast("오류", "내보낼 프로젝트를 선택하세요.", "danger");
    const project = App.db.projects[App.db.activeProjectId];
    const projectData = JSON.stringify(project, null, 2);
    const blob = new Blob([projectData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeFileName = project.name.replace(/[/\\?%*:|"<>]/g, '-') || 'project';
    a.href = url;
    a.download = `${safeFileName}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

// 자원 추가 모달 열기 핸들러
export function handleAddResourceClick() {
    if (!App.db.activeProjectId) return showToast("오류", "먼저 프로젝트를 선택하세요.", "warning");
    document.getElementById('resourceModalTitle').textContent = '새 자원 추가';
    document.getElementById('resource-id').value = '';
    document.getElementById('resource-name').value = '';
    document.getElementById('resource-content').value = '';
    document.getElementById('resource-file-input').value = '';
    App.bs.resourceModal.show();
}

// 자원 파일 변경 핸들러
export async function handleResourceFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const content = await readFileAsText(file);
        document.getElementById('resource-content').value = content;
        const resourceNameInput = document.getElementById('resource-name');
        if (!resourceNameInput.value) {
            resourceNameInput.value = file.name.replace(/\.[^/.]+$/, "");
        }
    } catch(err) { showToast('오류', err.message, 'danger'); }
    e.target.value = '';
}

// 자원 저장 핸들러
export async function handleSaveResourceClick() {
    const id = document.getElementById('resource-id').value;
    const name = document.getElementById('resource-name').value.trim();
    const content = document.getElementById('resource-content').value;
    if (!name || !content) return showToast("오류", "이름과 내용을 모두 입력하세요.", "danger");
    const project = App.db.projects[App.db.activeProjectId];
    if (!project) return;
    if (!project.resources) project.resources = [];
    const existingResource = id ? project.resources.find(r => r.id === id) : null;
    if (existingResource) {
        existingResource.name = name;
        existingResource.content = content;
    } else {
        project.resources.push({ id: `res_${Date.now()}`, name, content });
    }
    
    const success = await saveProjectToFirestore(project);
    if (success) {
        renderResourceList();
        App.bs.resourceModal.hide();
        showToast("성공", `자원이 ${id ? '수정' : '추가'}되었습니다.`, "success");
    }
}

// 학습 계획 적용 핸들러
export async function handleApplyPlanClick() {
    if (!App.db.activeProjectId) return showToast("오류", "먼저 프로젝트를 선택하세요.", "warning");
    if (!App.db.currentUser?.uid) return showToast("오류", "로그인이 필요합니다.", "danger");
    try {
        const planText = App.dom.planInput.value;
        const cleanedJsonString = planText.replace(/^```json\s*|```\s*$/g, '').trim();
        if (!cleanedJsonString) throw new Error("입력된 내용이 없습니다.");
        const planJSON = JSON.parse(cleanedJsonString);
        if (!planJSON.modules || !Array.isArray(planJSON.modules)) throw new Error("JSON에 'modules' 배열이 없습니다.");
        const project = App.db.projects[App.db.activeProjectId];
        
        project.learningPlan = planJSON;
        project.name = planJSON.projectName || project.name;
        project.goal = planJSON.mainGoal || project.goal;
        
        project.learningPlan.modules.forEach(module => {
            if (module.studyPad === undefined) module.studyPad = "";
            if (module.notes === undefined) module.notes = "";
            if (module.recommendedResources === undefined) module.recommendedResources = [];
        });

        const success = await saveProjectToFirestore(project);
        if (success) {
            render();
            showToast("성공", "학습 계획이 적용되었습니다.", "success");
        }
    } catch (e) {
        showToast("오류", "유효하지 않은 JSON 형식입니다: " + e.message, "danger");
    }
}

// 액션 관리자 모달 열기 핸들러
export function handleManageActionsClick() {
    if (!App.db.activeProjectId) return showToast("오류", "프로젝트를 선택하세요.", "warning");
    renderActionManager();
    App.bs.actionManagerModal.show();
}

// 액션 편집 모달 열기 핸들러
export function openActionEditor(actionKey = null) {
    const form = document.getElementById('action-editor-form');
    if (!form) return;
    form.reset();
    const project = App.db.projects[App.db.activeProjectId];
    const action = actionKey ? project?.actions.find(a => a.key === actionKey) : null;
    
    document.getElementById('actionEditorTitle').textContent = action ? '액션 편집' : '새 액션 추가';
    document.getElementById('action-key-input').value = action ? action.key : `custom_${Date.now()}`;
    if (action) {
        document.getElementById('action-title-input').value = action.title;
        document.getElementById('action-category-input').value = action.category;
        document.getElementById('action-purpose-input').value = action.purpose;
    }
    App.bs.actionEditorModal.show();
}

// 액션 저장 핸들러
export async function saveAction() {
    const project = App.db.projects[App.db.activeProjectId];
    if (!project) return;
    if (!App.db.currentUser?.uid) {
        showToast("오류", "로그인이 필요합니다.", "danger");
        return;
    }

    const key = document.getElementById('action-key-input').value;
    const updatedAction = {
        key: key,
        title: document.getElementById('action-title-input').value.trim(),
        category: document.getElementById('action-category-input').value.trim(),
        purpose: document.getElementById('action-purpose-input').value,
    };
    if (!updatedAction.title || !updatedAction.category || !updatedAction.purpose) {
        return showToast('오류', '모든 필드를 입력해야 합니다.', 'danger');
    }
    
    if (!project.actions) project.actions = [];
    const existingIndex = project.actions.findIndex(a => a.key === key);
    if (existingIndex > -1) {
        project.actions[existingIndex] = updatedAction;
    } else {
        project.actions.push(updatedAction);
    }
    
    const success = await saveProjectToFirestore(project);
    if (success) {
        renderActionManager();
        App.bs.actionEditorModal.hide();
        showToast('성공', '액션이 저장되었습니다.', 'success');
    }
}

// 액션 삭제 핸들러
export async function deleteAction(actionKey) {
    if (!App.db.currentUser?.uid) {
        showToast("오류", "로그인이 필요합니다.", "danger");
        return;
    }
    
    // showConfirmationModal로 대체
    showConfirmationModal('이 액션을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.', async (confirmed) => {
        if (confirmed) {
            const project = App.db.projects[App.db.activeProjectId];
            if (!project?.actions) return;
            project.actions = project.actions.filter(a => a.key !== actionKey);
            
            const success = await saveProjectToFirestore(project);
            if (success) {
                renderActionManager();
                showToast('성공', '액션이 삭제되었습니다.', 'success');
            }
        }
    });
}

// 스터디 패드 전체 다운로드 핸들러
export function downloadAllStudyPads() {
    const project = App.db.projects[App.db.activeProjectId];
    if (!project || !project.learningPlan?.modules?.length) {
        return showToast("정보", "다운로드할 스터디 패드 내용이 없습니다.", "info");
    }

    let combinedContent = `# ${project.name}\n\n`;
    combinedContent += `## 최종 학습 목표\n${project.goal || '없음'}\n\n`;
    combinedContent += `---\n\n`;

    project.learningPlan.modules.forEach((module, index) => {
        combinedContent += `## ${index + 1}. ${module.title}\n\n`;
        combinedContent += `### 핵심 개념: ${(module.keyConcepts || []).join(', ')}\n\n`;
        combinedContent += `### 학습 목표: ${(module.learningObjectives || []).join(', ')}\n\n`;
        if (module.recommendedResources && module.recommendedResources.length > 0) {
            combinedContent += `### 추천 리소스: ${module.recommendedResources.join(', ')}\n\n`;
        }
        combinedContent += `### 스터디 패드\n\n`;
        combinedContent += `${module.studyPad || '작성된 내용 없음.'}\n\n`;
        if (module.notes) {
            combinedContent += `### 개인 메모\n\n`;
            combinedContent += `${module.notes}\n\n`;
        }
        combinedContent += `---\n\n`;
    });

    const blob = new Blob([combinedContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeFileName = project.name.replace(/[/\\?%*:|"<>]/g, '-') || 'study-pads';
    a.href = url;
    a.download = `${safeFileName}_study_pads.md`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    showToast("성공", "스터디 패드 내용이 다운로드되었습니다.", "success");
}

// 프롬프트 실행 버튼 클릭 핸들러
export function handleExecutePromptClick() {
    const finalPromptText = App.dom.livePreviewContainer.textContent;
    App.copyToClipboard(finalPromptText); // Use App.copyToClipboard from main.js
}

// 사이드바 토글 핸들러
export function toggleSidebar() {
    App.dom.sidebar?.classList.toggle('is-open');
    App.dom.overlay?.classList.toggle('is-visible');
}
