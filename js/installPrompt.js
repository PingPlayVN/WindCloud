// installPrompt.js - Quản lý hiển thị và xử lý cài đặt PWA
let deferredPrompt = null;

export function showInstallPrompt() {
	const installBtn = document.getElementById('installBtn');
	if (!installBtn) return;
	installBtn.style.display = 'none'; // Ẩn mặc định
	installBtn.onclick = null;
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e;
		installBtn.style.display = 'block';
		installBtn.onclick = async () => {
			installBtn.style.display = 'none';
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'accepted') {
				console.log('User accepted the install prompt');
			} else {
				console.log('User dismissed the install prompt');
			}
			deferredPrompt = null;
		};
	});
}
