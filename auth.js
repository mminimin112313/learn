// auth.js
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { showToast } from './utils.js';
import { loadUserProjectsFromFirestore } from './db.js';
import { render } from './ui.js';
import { App } from './main.js'; // App 객체 참조

let authInstance; // Firebase Auth 인스턴스를 저장할 변수

export function initAuth(app) {
    authInstance = getAuth(app);
    onAuthStateChanged(authInstance, async (user) => {
        if (user) {
            App.dom.authStatus.textContent = `${user.displayName}님 환영합니다!`;
            App.dom.googleSigninBtn.classList.add('d-none');
            App.dom.signOutBtn.classList.remove('d-none');
            App.db.currentUser = {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email
            };
            await loadUserProjectsFromFirestore(user.uid); // Load user-specific projects
            render(); // Render after data is loaded from Firestore
            showToast("로그인됨", `${user.displayName}님 환영합니다!`, "info");
        } else {
            App.dom.authStatus.textContent = "로그인이 필요합니다.";
            App.dom.googleSigninBtn.classList.remove('d-none');
            App.dom.signOutBtn.classList.add('d-none');
            App.db.currentUser = null;
            App.db.activeProjectId = null;
            App.db.projects = {}; // Clear local projects on logout
            App.saveDb(); // Save local UI state (activeProjectId will be null)
            render(); // Re-render to show welcome screen
            showToast("로그아웃됨", "로그인하여 프로젝트를 관리하세요.", "info");
        }
    });
}

export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(authInstance, provider);
        // onAuthStateChanged 리스너가 토스트 메시지를 처리할 것이므로 여기서 중복 호출 안 함
    } catch (error) {
        console.error("Google 로그인 실패:", error);
        showToast("로그인 실패", "Google 로그인 중 오류가 발생했습니다: " + error.message, "danger");
    }
}

export async function signOutUser() {
    try {
        await signOut(authInstance);
        // onAuthStateChanged 리스너가 토스트 메시지를 처리할 것이므로 여기서 중복 호출 안 함
    } catch (error) {
        console.error("로그아웃 실패:", error);
        showToast("로그아웃 실패", "로그아웃 중 오류가 발생했습니다: " + error.message, "danger");
    }
}
