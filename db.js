// db.js
import { getFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from './utils.js';
import { DEFAULT_ACTIONS } from './constants.js';
import { App } from './main.js'; // App 객체 참조

let dbInstance; // Firestore 인스턴스를 저장할 변수

export function initFirestore(app) {
    dbInstance = getFirestore(app);
}

// Firestore에서 사용자 프로젝트를 로드하는 함수
export async function loadUserProjectsFromFirestore(userId) {
    App.db.projects = {}; // Clear existing projects
    try {
        // Firestore security rules will ensure only authenticated user can access their data
        const projectsColRef = collection(dbInstance, `users/${userId}/projects`);
        const q = query(projectsColRef);
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const projectData = doc.data();
            App.db.projects[doc.id] = { id: doc.id, ...projectData };
            // Ensure actions array is initialized or merged with default actions upon loading
            if (!App.db.projects[doc.id].actions || App.db.projects[doc.id].actions.length === 0) {
                App.db.projects[doc.id].actions = JSON.parse(JSON.stringify(DEFAULT_ACTIONS));
            } else {
                DEFAULT_ACTIONS.forEach(defaultAction => {
                    if (!App.db.projects[doc.id].actions.some(a => a.key === defaultAction.key)) {
                        App.db.projects[doc.id].actions.push(defaultAction);
                    }
                });
            }
        });

        // Set active project if one existed, or the first one if available
        if (App.db.activeProjectId && App.db.projects[App.db.activeProjectId]) {
            // Active project already set, keep it
        } else if (Object.keys(App.db.projects).length > 0) {
            App.db.activeProjectId = Object.keys(App.db.projects)[0];
        } else {
            App.db.activeProjectId = null;
        }
        console.log("Firebase에서 프로젝트 로드 완료");
    } catch (e) {
        console.error("Firebase에서 프로젝트 로드 실패:", e);
        showToast("데이터 로드 오류", "프로젝트를 불러오지 못했습니다.", "danger");
    }
}

// 프로젝트를 Firestore에 저장하는 함수
export async function saveProjectToFirestore(project) {
    if (!App.db.currentUser?.uid) {
        showToast("오류", "로그인이 필요합니다.", "danger");
        return false;
    }
    try {
        const projectRef = doc(dbInstance, `users/${App.db.currentUser.uid}/projects`, project.id);
        await setDoc(projectRef, project);
        console.log(`프로젝트 '${project.name}' Firebase에 저장됨`);
        return true;
    } catch (e) {
        console.error("Firebase에 프로젝트 저장 실패:", e);
        showToast("저장 실패", "프로젝트를 저장하지 못했습니다.", "danger");
        return false;
    }
}

// Firestore에서 프로젝트를 삭제하는 함수
export async function deleteProjectFromFirestore(projectId) {
    if (!App.db.currentUser?.uid) {
        showToast("오류", "로그인이 필요합니다.", "danger");
        return false;
    }
    try {
        const projectRef = doc(dbInstance, `users/${App.db.currentUser.uid}/projects`, projectId);
        await deleteDoc(projectRef);
        console.log(`프로젝트 '${projectId}' Firebase에서 삭제됨`);
        return true;
    } catch (e) {
        console.error("Firebase에서 프로젝트 삭제 실패:", e);
        showToast("삭제 실패", "프로젝트를 삭제하지 못했습니다.", "danger");
        return false;
    }
}

// 모듈 필드를 업데이트하고 Firestore에 저장하는 함수 (debounce 포함)
export function updateModuleField(index, field, value) {
    const project = App.db.projects[App.db.activeProjectId];
    if (!project?.learningPlan?.modules[index]) return;

    project.learningPlan.modules[index][field] = value;
    // Debounce Firestore save for module updates
    clearTimeout(App.state.saveTimeout);
    App.state.saveTimeout = setTimeout(async () => {
        const success = await saveProjectToFirestore(project);
        if (success) {
            App.renderLearningDashboard(); // Re-render to update UI (e.g., progress bar)
        }
    }, 1000); // Save after 1 second of inactivity
}
