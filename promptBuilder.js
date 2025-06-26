// promptBuilder.js
import { App } from './main.js';
import { showToast } from './utils.js';
import { MASTER_PROMPT_SHELL } from './constants.js';

// 프롬프트 생성 모달을 열고 내용을 채우는 함수
export function handleBuildPrompt(templateKey, moduleIndex) {
    App.bs.actionSelectorModal.hide();

    const project = App.db.projects[App.db.activeProjectId];
    if (!project) return;
    
    // DEFAULT_ACTIONS 대신 App.DEFAULT_ACTIONS_CONST 사용
    const template = (project.actions || []).find(a => a.key === templateKey);
    if (!template) return showToast('오류', '액션을 찾을 수 없습니다.', 'danger');

    const module = moduleIndex !== undefined && project.learningPlan ? project.learningPlan.modules[moduleIndex] : null;

    App.dom.promptModalLabel.textContent = template.title;
    App.dom.dynamicFormContainer.innerHTML = '';
    
    App.dom.dataSelector.innerHTML = '<option value="">자원 라이브러리에서 선택</option>';
    (project.resources || []).forEach(r => App.dom.dataSelector.innerHTML += `<option value="${r.id}">${r.name}</option>`);

    let purposeTemplate = template.purpose;
    const context = { '학습 목표': project.goal, '현재 수준': '지식이 필요한 학습자', ...(module || {}) };
    if (module) {
        context['모듈 제목'] = module.title;
        context['핵심 개념'] = (module.keyConcepts || []).join(', ');
        // Add recommended resources to context for template if available
        if (module.recommendedResources && module.recommendedResources.length > 0) {
            context['추천 리소스'] = module.recommendedResources.join(', ');
        }
    }
    
    // Extract variables that are still [VAR_NAME] after initial pre-filling
    const variables = [...new Set([...purposeTemplate.matchAll(/\[(.*?)\]/g)].map(m => m[1]))];
    variables.forEach(varName => {
        const prefilledValue = context[varName];
        if (prefilledValue) {
            purposeTemplate = purposeTemplate.replaceAll(`[${varName}]`, prefilledValue);
        } else {
            App.dom.dynamicFormContainer.innerHTML += `<div class="mb-3"><label for="var-${varName}" class="form-label form-label-sm">${varName}</label><input type="text" id="var-${varName}" class="form-control form-control-sm dynamic-var-input" data-var-name="${varName}" placeholder="${varName} 내용 입력..."></div>`;
        }
    });

    let currentDataSource = 'none';
    if (module?.studyPad && (templateKey.startsWith('1_') || templateKey.startsWith('2_'))) {
        currentDataSource = 'studypad';
    }
    // Reset radio buttons and then set the correct one
    document.querySelectorAll('input[name="dataSource"]').forEach(radio => radio.checked = false);
    const initialDataSourceRadio = document.getElementById(`source-${currentDataSource}`);
    if (initialDataSourceRadio) {
        initialDataSourceRadio.checked = true;
    }
    document.getElementById('data-direct-input').value = '';

    const dataSourceContainers = {
        resource: document.getElementById('data-selector-container'),
        direct: document.getElementById('data-direct-input-container'),
    };
    
    // 데이터 소스 가시성을 업데이트하는 내부 함수
    const updateDataSourceVisibility = () => {
        const selected = document.querySelector('input[name="dataSource"]:checked').value;
        Object.values(dataSourceContainers).forEach(c => c.classList.add('d-none'));
        if (dataSourceContainers[selected]) {
            dataSourceContainers[selected].classList.remove('d-none');
        }
    };

    // 프롬프트 미리보기를 업데이트하는 내부 함수
    const updatePreview = () => {
        let previewPurpose = purposeTemplate;
        App.dom.dynamicFormContainer.querySelectorAll('.dynamic-var-input').forEach(input => {
            const varName = input.dataset.varName;
            const value = input.value || `[${varName}]`;
            previewPurpose = previewPurpose.replaceAll(`[${varName}]`, value);
        });
        
        const selectedDataSource = document.querySelector('input[name="dataSource"]:checked').value;
        let dataContent = '없음';
        if (selectedDataSource === 'resource') {
            const resId = App.dom.dataSelector.value;
            if (resId) dataContent = (project.resources.find(r => r.id === resId) || {}).content;
        } else if (selectedDataSource === 'studypad') {
            if (module?.studyPad) dataContent = module.studyPad;
        } else if (selectedDataSource === 'direct') {
            dataContent = document.getElementById('data-direct-input').value;
        }
        
        const contextForAI = {
            projectName: project.name,
            mainGoal: project.goal,
        };
        if (project.learningPlan) {
            contextForAI.tutorPersona = project.learningPlan.tutorPersona;
            contextForAI.fullTableOfContents = project.learningPlan.modules.map(m => ({ id: m.id, title: m.title, status: m.status }));
        }
        if (module) {
            const { studyPad, notes, ...currentModuleContext } = module;
            contextForAI.currentModule = currentModuleContext;
        }
        const projectContext = JSON.stringify(contextForAI, null, 2);
        let finalPrompt = MASTER_PROMPT_SHELL.replace(/{{purpose}}/g, previewPurpose)
                                             .replace(/{{data}}/g, dataContent || '내용 없음')
                                             .replace(/{{projectContext}}/g, projectContext);
        App.dom.livePreviewContainer.textContent = finalPrompt;
    };

    // 이벤트 리스너 재등록
    document.querySelectorAll('input[name="dataSource"]').forEach(radio => radio.onchange = () => {
        updateDataSourceVisibility();
        updatePreview();
    });

    App.dom.dynamicFormContainer.addEventListener('input', updatePreview);
    App.dom.dataSelector.addEventListener('change', updatePreview);
    document.getElementById('data-direct-input').addEventListener('input', updatePreview);
    
    updateDataSourceVisibility();
    updatePreview();
    App.bs.promptModal.show();
}
