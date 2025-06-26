// utils.js
// Toast 메시지를 표시하는 함수
export function showToast(title, body, type = 'info') {
    const toastEl = document.getElementById('liveToast');
    if (!toastEl) return;
    toastEl.style.borderColor = `var(--${type}-color, var(--border-color))`;
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-body').textContent = body;
    // App.bs.toast는 main.js에서 초기화되므로 직접 접근하지 않고, DOM 요소를 통해 제어
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
    toast.show();
}

// 텍스트를 클립보드에 복사하는 함수
export async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            showToast("성공", "클립보드에 복사되었습니다.", "success");
            return;
        } catch (err) { console.warn("Clipboard API 실패, 폴백 시도:", err); }
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast("성공", "클립보드에 복사되었습니다.", "success");
    } catch (err) {
        showToast("오류", "복사에 실패했습니다.", "danger");
        console.error("폴백 복사 실패:", err);
    }
    document.body.removeChild(textArea);
}

// 파일을 텍스트로 읽는 함수
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => {
            reader.abort();
            reject(new DOMException("파일 읽기 중 문제가 발생했습니다."));
        };
        reader.readAsText(file);
    });
}

// 사용자 정의 확인 모달을 표시하는 함수 (window.confirm 대체)
export function showConfirmationModal(message, onConfirm) {
    const confirmModalEl = document.getElementById('confirmationModal');
    if (!confirmModalEl) return;

    const modalMessageEl = document.getElementById('confirmationModalMessage');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    modalMessageEl.textContent = message;

    const bsConfirmModal = new bootstrap.Modal(confirmModalEl);
    bsConfirmModal.show();

    // 기존 이벤트 리스너 제거 (중복 호출 방지)
    const newOkHandler = () => {
        onConfirm(true);
        bsConfirmModal.hide();
        confirmOkBtn.removeEventListener('click', newOkHandler);
        confirmCancelBtn.removeEventListener('click', newCancelHandler);
    };
    const newCancelHandler = () => {
        onConfirm(false);
        bsConfirmModal.hide();
        confirmOkBtn.removeEventListener('click', newOkHandler);
        confirmCancelBtn.removeEventListener('click', newCancelHandler);
    };

    confirmOkBtn.addEventListener('click', newOkHandler);
    confirmCancelBtn.addEventListener('click', newCancelHandler);
    // 모달이 완전히 닫혔을 때 이벤트 리스너 정리
    confirmModalEl.addEventListener('hidden.bs.modal', function handler() {
        confirmOkBtn.removeEventListener('click', newOkHandler);
        confirmCancelBtn.removeEventListener('click', newCancelHandler);
        confirmModalEl.removeEventListener('hidden.bs.modal', handler);
    });
}
