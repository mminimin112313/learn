// ui.js
import { App } from './main.js';
import { showToast } from './utils.js';
import { saveProjectToFirestore } from './db.js';

let chartInstance = null; // Chart.js 인스턴스를 저장할 변수

// 모든 UI를 렌더링하는 메인 함수
export function render() {
    renderProjectList();
    renderWorkspace();
}

// 프로젝트 목록을 렌더링하는 함수
export function renderProjectList() {
    const listEl = App.dom.projectList;
    if (!listEl) return;

    // Empty state 요소를 숨김 처리
    App.dom.projectListEmptyState?.classList.add('hidden');

    if (!App.db.currentUser) {
        listEl.innerHTML = `<p class="small text-secondary-gray-600 px-2 py-2">로그인 후 프로젝트를 이용할 수 있습니다.</p>`;
        App.dom.projectListEmptyState?.classList.remove('hidden'); // 로그인 필요 메시지 표시 후에도 빈 상태 UI 표시
        return;
    }

    const projectIds = Object.keys(App.db.projects);

    if (projectIds.length === 0) {
        listEl.innerHTML = ``; // 기존 목록 비우기
        App.dom.projectListEmptyState?.classList.remove('hidden'); // Empty state 표시
        return;
    }

    listEl.innerHTML = ''; // Clear previous content, ensure empty state is not duplicated
    projectIds.forEach(id => {
        const p = App.db.projects[id];
        const item = document.createElement('a');
        item.href = '#';
        item.className = `list-group-item list-group-item-action d-flex justify-content-between items-center rounded-md hover:shadow-md transition-shadow duration-200 ${p.id === App.db.activeProjectId ? 'active' : ''}`;
        item.dataset.projectId = p.id;
        item.innerHTML = `
            <span class="text-truncate">${p.name}</span>
            <i class="fa-solid fa-trash-can text-secondary-gray-600 text-sm delete-btn" title="프로젝트 삭제"></i>
        `;
        listEl.appendChild(item);
    });
}

// 메인 워크스페이스를 렌더링하는 함수
export function renderWorkspace() {
    const project = App.db.projects[App.db.activeProjectId];
    if (!project) {
        App.dom.welcomeScreen?.classList.remove('hidden');
        App.dom.projectWorkspace?.classList.add('hidden');
        if (App.dom.projectTitleMobile) App.dom.projectTitleMobile.textContent = "ILE v8.5"; // Updated version
        return;
    }

    App.dom.welcomeScreen?.classList.add('hidden');
    App.dom.projectWorkspace?.classList.remove('hidden');
    
    App.dom.projectTitleMain.textContent = project.name;
    App.dom.projectTitleMobile.textContent = project.name;
    App.dom.projectGoal.textContent = project.goal;
    App.dom.planInput.value = project.learningPlan ? JSON.stringify(project.learningPlan, null, 2) : '';
    
    renderResourceList();
    renderLearningDashboard();
}

// 자원 목록을 렌더링하는 함수
export function renderResourceList() {
    const listEl = App.dom.resourceList;
    if (!listEl) return;

    App.dom.resourceListEmptyState?.classList.add('hidden'); // Empty state 숨김

    const project = App.db.projects[App.db.activeProjectId];
    
    if (!project?.resources?.length) {
        listEl.innerHTML = ``; // 기존 목록 비우기
        App.dom.resourceListEmptyState?.classList.remove('hidden'); // Empty state 표시
        return;
    }

    listEl.innerHTML = ''; // Clear previous content, ensure empty state is not duplicated
    project.resources.forEach(r => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between items-center rounded-md hover:shadow-md transition-shadow duration-200';
        item.dataset.resourceId = r.id;
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <span class="text-truncate">${r.name}</span>
            <i class="fa-solid fa-times text-secondary-gray-600 text-sm delete-btn" title="자원 삭제" style="cursor: pointer;"></i>
        `;
        listEl.appendChild(item);
    });
}

// 학습 대시보드를 렌더링하는 함수
export function renderLearningDashboard() {
    const dashboard = App.dom.learningDashboard;
    if (!dashboard) return;

    App.dom.learningDashboardEmptyState?.classList.add('hidden'); // Empty state 숨김

    const project = App.db.projects[App.db.activeProjectId];
    const plan = project?.learningPlan;

    if (!plan?.modules?.length) {
        dashboard.innerHTML = ''; // 기존 목록 비우기
        App.dom.learningDashboardEmptyState?.classList.remove('hidden'); // Empty state 표시
        // Chart를 초기화 (데이터가 없으므로)
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        // 진행률 통계 초기화
        App.dom.overallProgressBar.style.width = `0%`;
        App.dom.overallProgressBar.setAttribute('aria-valuenow', 0);
        App.dom.overallProgressBar.textContent = `0%`;
        App.dom.overallProgressBar.style.backgroundColor = 'var(--text-secondary)';
        App.dom.completedModulesCount.textContent = 0;
        App.dom.inprogressModulesCount.textContent = 0;
        App.dom.pendingModulesCount.textContent = 0;
        return;
    }

    dashboard.innerHTML = '';
    plan.modules.forEach((module, index) => {
        const card = document.createElement('div');
        // 모서리 규칙 1:2 적용 (outer rounded-xl, inner rounded-lg)
        card.className = `module-card status-${module.status || 'pending'} rounded-xl`; 
        card.dataset.moduleIndex = index;

        // Truncate learning objectives and add a "자세히 보기" button
        const learningObjectivesText = (module.learningObjectives || []).join(', ');
        const displayLearningObjectives = `<b>학습 목표:</b> <span class="learning-objectives-preview">${learningObjectivesText || '없음'}</span>`;
        const viewObjectivesButton = learningObjectivesText.length > 50 ? // Adjust length as needed
            `<button class="btn btn-link btn-sm p-0 d-block mt-1 view-details-btn" data-detail-type="learning-objectives" data-module-index="${index}">자세히 보기</button>` : '';

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h6 class="mb-0 text-lg font-semibold text-secondary-gray-800">${module.title}</h6> <!-- H5: 20px -->
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle py-1 px-2 rounded-lg" type="button" data-bs-toggle="dropdown">상태</button>
                    <ul class="dropdown-menu rounded-lg">
                        <li><a class="dropdown-item status-change-btn text-base" href="#" data-status="pending">대기</a></li>
                        <li><a class="dropdown-item status-change-btn text-base" href="#" data-status="inprogress">진행 중</a></li>
                        <li><a class="dropdown-item status-change-btn text-base" href="#" data-status="completed">완료</a></li>
                    </ul>
                </div>
            </div>
            <p class="text-sm text-secondary-gray-600 mb-2"><b>핵심 개념:</b> ${(module.keyConcepts || []).join(', ')}</p>
            <p class="text-sm mb-3">${displayLearningObjectives}${viewObjectivesButton}</p>
            ${module.recommendedResources && module.recommendedResources.length > 0 ? 
                `<p class="text-sm text-primary-blue-middle mb-3"><b>추천 리소스:</b> ${module.recommendedResources.join(', ')}</p>` : ''
            }
            <div class="mb-2">
                <label class="form-label text-sm text-secondary-gray-600">스터디 패드</label>
                <textarea class="form-control form-control-sm module-studypad rounded-lg" placeholder="이 모듈에 대한 AI 생성 학습 내용을 여기에 붙여넣으세요...">${module.studyPad || ''}</textarea>
                <button class="btn btn-sm btn-outline-primary mt-2 rounded-lg view-studypad-btn"><i class="fa-solid fa-eye me-1"></i> 스터디 패드 보기</button>
            </div>
            <div class="mb-3">
                <label class="form-label text-sm text-secondary-gray-600">개인 메모</label>
                <textarea class="form-control form-control-sm module-notes rounded-lg" placeholder="생각, 질문 등을 자유롭게 메모하세요...">${module.notes || ''}</textarea>
            </div>
            <button class="btn btn-sm btn-info w-full open-action-selector rounded-lg"><i class="fa-solid fa-person-chalkboard me-2"></i>액션 실행</button>
        `;
        dashboard.appendChild(card);
    });

    // Calculate progress and update stats
    const totalModules = plan.modules.length;
    const completedModules = plan.modules.filter(m => m.status === 'completed').length;
    const inprogressModules = plan.modules.filter(m => m.status === 'inprogress').length;
    const pendingModules = totalModules - completedModules - inprogressModules;

    const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

    // Update overall progress bar color based on status
    let progressBarColor = 'var(--semantic-info)'; // Default for pending (Light Blue)
    if (completionPercentage > 0 && completionPercentage < 100) {
        progressBarColor = 'var(--semantic-warning)'; // In progress
    } else if (completionPercentage === 100) {
        progressBarColor = 'var(--semantic-success)'; // Completed
    }
    App.dom.overallProgressBar.style.width = `${completionPercentage}%`;
    App.dom.overallProgressBar.setAttribute('aria-valuenow', completionPercentage);
    App.dom.overallProgressBar.textContent = `${completionPercentage}%`;
    App.dom.overallProgressBar.style.backgroundColor = progressBarColor;


    App.dom.completedModulesCount.textContent = completedModules;
    App.dom.inprogressModulesCount.textContent = inprogressModules;
    App.dom.pendingModulesCount.textContent = pendingModules;

    // Chart.js rendering
    if (chartInstance) {
        chartInstance.destroy(); // Destroy previous chart instance if exists
    }
    if (totalModules > 0 && App.dom.moduleStatusChart) {
        const ctx = App.dom.moduleStatusChart.getContext('2d');
        // Define colors directly using the hex values from :root CSS variables for reliability
        const successColor = getComputedStyle(document.documentElement).getPropertyValue('--semantic-success');
        const warningColor = getComputedStyle(document.documentElement).getPropertyValue('--semantic-warning');
        const secondaryTextColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
        const primaryTextColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');

        chartInstance = new Chart(ctx, {
            type: 'doughnut', // Pie chart for statuses
            data: {
                labels: ['완료', '진행 중', '대기'],
                datasets: [{
                    data: [completedModules, inprogressModules, pendingModules],
                    backgroundColor: [
                        successColor,
                        warningColor,
                        secondaryTextColor
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: primaryTextColor, // Adjust legend color for light theme
                        }
                    },
                    title: {
                        display: true,
                        text: '모듈 상태 분석',
                        color: primaryTextColor, // Adjust title color
                    }
                }
            }
        });
    }
}

// 액션 선택기를 렌더링하는 함수
export function renderActionSelector(moduleIndex) {
    const body = App.dom.actionSelectorBody;
    const project = App.db.projects[App.db.activeProjectId];
    // Ensure DEFAULT_ACTIONS are always included if the project's actions array is empty or undefined
    const actions = project?.actions && project.actions.length > 0 ? project.actions : App.DEFAULT_ACTIONS_CONST;

    const groupedActions = actions.reduce((acc, action) => {
        if (action.key === '0_plan') return acc;
        const category = action.category || '기타';
        if (!acc[category]) acc[category] = [];
        acc[category].push(action);
        return acc;
    }, {});

    body.innerHTML = '';
    for (const category of Object.keys(groupedActions).sort()) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'action-category mb-4 rounded-r-md'; // rounded-r-md 적용
        categoryDiv.innerHTML = `<h6 class="mb-3 text-lg font-semibold text-primary-blue-middle">${category}</h6>`; // H5 크기 (20px)
        const actionGrid = document.createElement('div');
        actionGrid.className = 'grid gap-2'; // Tailwind grid gap
        groupedActions[category].forEach(action => {
            const button = document.createElement('button');
            // 터치 영역 최소 44x44px를 보장하기 위해 padding-y와 padding-x를 충분히 줌
            button.className = 'btn btn-outline-light text-start w-full py-2.5 px-4 rounded-lg build-prompt-btn hover:shadow-sm transition-shadow duration-200';
            button.dataset.templateKey = action.key;
            button.dataset.moduleIndex = moduleIndex;
            button.textContent = action.title;
            actionGrid.appendChild(button);
        });
        categoryDiv.appendChild(actionGrid);
        body.appendChild(categoryDiv);
    }
    App.bs.actionSelectorModal.show();
}

// 액션 관리자를 렌더링하는 함수
export function renderActionManager() {
    const container = App.dom.actionListContainer;
    if (!container) return;
    const project = App.db.projects[App.db.activeProjectId];
    // Ensure DEFAULT_ACTIONS are always included if the project's actions array is empty or undefined
    const actions = project?.actions && project.actions.length > 0 ? project.actions : App.DEFAULT_ACTIONS_CONST;

    container.innerHTML = actions.map(action => {
        if(action.key === '0_plan') return ''; 
        return `
        <div class="p-4 rounded-xl mb-3 flex justify-between items-center action-list-item shadow-sm">
            <div>
                <h6 class="mb-0 text-lg font-semibold text-secondary-gray-800">${action.title}</h6>
                <small class="text-secondary-gray-600">${action.category} / Key: ${action.key}</small>
            </div>
            <div class="flex gap-2">
                <button class="btn btn-sm btn-outline-light rounded-lg edit-action-btn p-2 w-10 h-10 flex items-center justify-center" data-action-key="${action.key}"><i class="fa-solid fa-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger rounded-lg delete-action-btn p-2 w-10 h-10 flex items-center justify-center" data-action-key="${action.key}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`;
    }).join('');
}

// 스터디 패드 뷰어를 여는 함수
export function openStudyPadViewer(moduleIndex) {
    const project = App.db.projects[App.db.activeProjectId];
    if (!project || !project.learningPlan?.modules[moduleIndex]) {
        return showToast("오류", "모듈을 찾을 수 없습니다.", "danger");
    }
    const module = project.learningPlan.modules[moduleIndex];
    
    App.state.currentModuleIndexForViewer = moduleIndex; // Store current module index
    
    // Set initial mode to viewer mode
    App.dom.studyPadViewerContent.classList.remove('hidden');
    App.dom.studyPadEditorContent.classList.add('hidden');
    App.dom.toggleViewerModeBtn.textContent = '편집 모드';
    App.dom.saveViewerContentBtn.classList.add('hidden');

    App.dom.studyPadViewerTitle.textContent = `${module.title} 스터디 패드`;
    // Use marked.js to convert Markdown to HTML
    App.dom.studyPadViewerContent.innerHTML = marked.parse(module.studyPad || '내용이 없습니다.');
    App.dom.studyPadEditorContent.value = module.studyPad || ''; // Populate editor with raw content
    
    App.bs.studyPadViewerModal.show();

    // Restore scroll position when modal opens
    App.dom.studyPadViewerModal.addEventListener('shown.bs.modal', function handler() {
        const savedScroll = App.state.scrollPositions[`module_${moduleIndex}`];
        if (savedScroll !== undefined) {
            App.dom.studyPadViewerContent.scrollTop = savedScroll;
            App.dom.studyPadEditorContent.scrollTop = savedScroll; // Apply to editor too
        }
        App.dom.studyPadViewerModal.removeEventListener('shown.bs.modal', handler); // Remove listener after first execution
    });

    // Call MathJax to render equations after content is set
    if (typeof MathJax !== 'undefined') {
        MathJax.typesetPromise([App.dom.studyPadViewerContent]).catch((err) => console.error('MathJax rendering failed:', err));
    }
}

// 스터디 패드 뷰어 모드를 토글하는 함수
export function toggleStudyPadViewerMode() {
    const moduleIndex = App.state.currentModuleIndexForViewer;
    const isEditing = App.dom.studyPadViewerContent.classList.contains('hidden'); // True if editor is currently hidden

    // Save current scroll position before switching modes
    const currentScroll = isEditing ? App.dom.studyPadEditorContent.scrollTop : App.dom.studyPadViewerContent.scrollTop;
    App.state.scrollPositions[`module_${moduleIndex}`] = currentScroll;
    App.saveDb(); // Save local UI state

    if (!isEditing) { // Currently in viewer mode, switch to editor mode
        App.dom.studyPadViewerContent.classList.add('hidden');
        App.dom.studyPadEditorContent.classList.remove('hidden');
        App.dom.toggleViewerModeBtn.textContent = '뷰어 모드';
        App.dom.saveViewerContentBtn.classList.remove('hidden');
        App.dom.studyPadEditorContent.focus();
        // Restore scroll position for the editor
        App.dom.studyPadEditorContent.scrollTop = currentScroll;
    } else { // Currently in editor mode, switch to viewer mode
        App.dom.studyPadViewerContent.innerHTML = marked.parse(App.dom.studyPadEditorContent.value);
        
        // Call MathJax to render equations after content is set
        if (typeof MathJax !== 'undefined') {
            MathJax.typesetPromise([App.dom.studyPadViewerContent]).catch((err) => console.error('MathJax rendering failed:', err));
        }

        App.dom.studyPadViewerContent.classList.remove('hidden');
        App.dom.studyPadEditorContent.classList.add('hidden');
        App.dom.toggleViewerModeBtn.textContent = '편집 모드';
        App.dom.saveViewerContentBtn.classList.add('hidden');
        // Restore scroll position for the viewer
        App.dom.studyPadViewerContent.scrollTop = currentScroll;
    }
}

// 스터디 패드 뷰어 콘텐츠를 저장하는 함수
export function saveStudyPadViewerContent() {
    const moduleIndex = App.state.currentModuleIndexForViewer;
    if (moduleIndex === null) {
        showToast("오류", "저장할 모듈을 찾을 수 없습니다.", "danger");
        return;
    }
    const newStudyPadContent = App.dom.studyPadEditorContent.value;
    App.updateModuleField(moduleIndex, 'studyPad', newStudyPadContent); // This will save to DB
    showToast("성공", "스터디 패드 내용이 저장되었습니다.", "success");
    toggleStudyPadViewerMode(); // Switch back to viewer mode after saving
}

// 상세 보기 모달을 여는 함수
export function openDetailViewer(moduleIndex, type) {
    const project = App.db.projects[App.db.activeProjectId];
    if (!project || !project.learningPlan?.modules[moduleIndex]) {
        return showToast("오류", "모듈을 찾을 수 없습니다.", "danger");
    }
    const module = project.learningPlan.modules[moduleIndex];
    let title = '';
    let content = '';

    if (type === 'learning-objectives') {
        title = `${module.title} 학습 목표`;
        content = (module.learningObjectives || []).join('\n- ');
        content = `- ${content}`; // Markdown list for display
    }
    // Add more types if needed, e.g., 'key-concepts'

    App.dom.detailViewerTitle.textContent = title;
    App.dom.detailViewerBody.innerHTML = `<pre class="detail-modal-content">${content}</pre>`; // Use <pre> for plain text
    App.bs.detailViewerModal.show();
}

// Empty State 로직 추가 (renderProjectList, renderResourceList, renderLearningDashboard에서 호출)
export function toggleEmptyStateVisibility() {
    if (App.db.currentUser) {
        const hasProjects = Object.keys(App.db.projects).length > 0;
        App.dom.projectListEmptyState?.classList.toggle('hidden', hasProjects);

        const activeProject = App.db.projects[App.db.activeProjectId];
        const hasResources = activeProject?.resources?.length > 0;
        App.dom.resourceListEmptyState?.classList.toggle('hidden', hasResources);

        const hasModules = activeProject?.learningPlan?.modules?.length > 0;
        App.dom.learningDashboardEmptyState?.classList.toggle('hidden', hasModules);
    } else {
        // 로그인되지 않은 경우, 모든 빈 상태 UI 표시
        App.dom.projectListEmptyState?.classList.remove('hidden');
        App.dom.resourceListEmptyState?.classList.remove('hidden');
        App.dom.learningDashboardEmptyState?.classList.remove('hidden');
    }
}
