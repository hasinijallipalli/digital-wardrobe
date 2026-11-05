const categories = {
	Male: ['Shirts', 'T-shirts', 'Pants', 'Jeans', 'Shorts', 'Suits', 'Shoes', 'Accessories'],
	Female: ['Tops', 'Dresses', 'Skirts', 'Jeans', 'Trousers', 'Outerwear', 'Shoes', 'Handbags', 'Accessories']
};
let profile = null;
let items = [];
let selectedItemIds = [];
let pickingOutfit = false;
let selectedImage = '';
let authMode = 'login';
let adminCredentials = null;
const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
	const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || 'Something went wrong. Please try again.');
	}
	return response.status === 204 ? null : response.json();
}

function setCategories() {
	const options = categories[profile.gender];
	$('categoryFilter').innerHTML = '<option value="All">All categories</option>' + options.map((category) => `<option>${category}</option>`).join('');
	$('itemCategory').innerHTML = '<option value="" disabled selected>Choose a category</option>' + options.map((category) => `<option>${category}</option>`).join('');
}

function showApp() {
	$('loginPage').classList.add('hidden');
	$('adminPage').classList.add('hidden');
	$('app').classList.remove('hidden');
	$('userLabel').textContent = `${profile.name} · ${profile.gender}`;
	$('avatar').textContent = profile.name.charAt(0).toUpperCase();
	$('welcomeTitle').textContent = `Hello, ${profile.name}.`;
	$('wardrobeSubtitle').textContent = 'A calm little home for everything you love to wear.';
	items = profile.items || [];
	setCategories();
	renderItems();
}

function renderItems() {
	const query = $('searchInput').value.toLowerCase();
	const category = $('categoryFilter').value;
	const visibleItems = items.filter((item) => (category === 'All' || item.category === category) && item.name.toLowerCase().includes(query));
	$('closetGrid').innerHTML = visibleItems.length ? visibleItems.map((item) => `<article class="item-card ${pickingOutfit ? 'selectable ' : ''}${selectedItemIds.includes(item.id) ? 'selected' : ''}" data-item-id="${item.id}"><button class="delete-btn" data-id="${item.id}" type="button" aria-label="Delete ${item.name}">&times;</button><img class="item-image" src="${item.image}" alt="${item.name}"><div class="item-info"><strong>${item.name}</strong><span>${item.category}</span></div></article>`).join('') : '<div class="empty"><strong>Your closet is waiting.</strong>Add your first clothing photo to start seeing your style at a glance.</div>';
	$('totalCount').textContent = items.length;
	$('categoryCount').textContent = new Set(items.map((item) => item.category)).size;
	$('latestCount').textContent = items.filter((item) => item.createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000).length;
	document.querySelectorAll('.delete-btn').forEach((button) => button.addEventListener('click', async () => {
		try {
			await api(`/api/items/${button.dataset.id}`, { method: 'DELETE' });
			items = items.filter((item) => item.id !== Number(button.dataset.id));
			selectedItemIds = selectedItemIds.filter((id) => id !== Number(button.dataset.id));
			renderItems();
		} catch (error) { alert(error.message); }
	}));
	document.querySelectorAll('.item-card.selectable').forEach((card) => card.addEventListener('click', (event) => {
		if (event.target.closest('.delete-btn')) return;
		const id = Number(card.dataset.itemId);
		selectedItemIds = selectedItemIds.includes(id) ? selectedItemIds.filter((selectedId) => selectedId !== id) : [...selectedItemIds, id];
		renderItems();
	}));
	updateOutfitTray();
}

function updateOutfitTray() {
	const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));
	$('outfitTray').classList.toggle('hidden', !selectedItems.length);
	$('outfitCount').textContent = `${selectedItems.length} ${selectedItems.length === 1 ? 'piece' : 'pieces'} selected`;
	$('outfitItems').innerHTML = selectedItems.map((item) => `<div class="outfit-piece"><img class="outfit-thumb" src="${item.image}" alt="${item.name}"><div><strong>${item.name}</strong><span>${item.category}</span></div></div>`).join('');
}

function closeModal() {
	$('modalBackdrop').classList.add('hidden');
	$('itemForm').reset();
	$('preview').classList.add('hidden');
	$('uploadText').classList.remove('hidden');
	selectedImage = '';
}

function setAuthMode(mode) {
	authMode = mode;
	const creating = mode === 'create';
	$('loginTitle').textContent = creating ? 'Create your account' : 'Log in to your wardrobe';
	$('loginDescription').textContent = creating ? 'Create an account to keep your wardrobe private.' : 'Use your user ID and password to continue.';
	$('name').previousElementSibling.textContent = creating ? 'Your name' : 'User ID';
	$('genderField').classList.toggle('hidden', !creating);
	$('genderField').querySelectorAll('input').forEach((input) => { input.required = creating && input.value === 'Male'; });
	$('authSubmitBtn').textContent = creating ? 'Create account' : 'Log in';
	$('loginModeBtn').classList.toggle('active', !creating);
	$('createModeBtn').classList.toggle('active', creating);
	$('loginModeBtn').setAttribute('aria-selected', String(!creating));
	$('createModeBtn').setAttribute('aria-selected', String(creating));
}

async function renderAccounts() {
	const accounts = await api('/api/admin/accounts', { headers: { 'X-Admin-Name': adminCredentials.name, 'X-Admin-Password': adminCredentials.password } });
	$('accountCount').textContent = `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}`;
	$('accountList').innerHTML = accounts.length ? accounts.map((account) => `<div class="account-row"><div class="account-details"><strong>${account.name}</strong><span>${account.gender} · ${account.items} clothing items</span></div><div class="account-actions"><span class="status-label ${account.active ? '' : 'disabled'}">${account.active ? 'Active' : 'Disabled'}</span><button class="secondary-btn account-toggle" data-id="${account.id}" data-active="${account.active}" type="button">${account.active ? 'Disable' : 'Activate'}</button><button class="danger-btn account-delete" data-id="${account.id}" type="button">Delete</button></div></div>`).join('') : '<div class="empty"><strong>No accounts yet.</strong>User accounts will appear here.</div>';
	document.querySelectorAll('.account-toggle').forEach((button) => button.addEventListener('click', async () => {
		await api(`/api/admin/accounts/${button.dataset.id}`, { method: 'PATCH', headers: { 'X-Admin-Name': adminCredentials.name, 'X-Admin-Password': adminCredentials.password }, body: JSON.stringify({ active: button.dataset.active !== 'true' }) });
		renderAccounts();
	}));
	document.querySelectorAll('.account-delete').forEach((button) => button.addEventListener('click', async () => {
		if (!confirm('Delete this account and its wardrobe?')) return;
		await api(`/api/admin/accounts/${button.dataset.id}`, { method: 'DELETE', headers: { 'X-Admin-Name': adminCredentials.name, 'X-Admin-Password': adminCredentials.password } });
		renderAccounts();
	}));
}

async function init() {
	try {
		profile = await api('/api/auth/me');
		showApp();
	} catch { $('loginPage').classList.remove('hidden'); }
}

$('loginForm').addEventListener('submit', async (event) => {
	event.preventDefault();
	try {
		const name = $('name').value.trim();
		const password = $('password').value;
		if (authMode === 'create') {
			await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, password, gender: document.querySelector('input[name="gender"]:checked')?.value }) });
			$('loginForm').reset();
			setAuthMode('login');
			alert('Account created. Please log in to continue.');
		} else {
			profile = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ name, password }) });
			showApp();
		}
	} catch (error) { alert(error.message); }
});
$('loginModeBtn').addEventListener('click', () => setAuthMode('login'));
$('createModeBtn').addEventListener('click', () => setAuthMode('create'));
$('logoutBtn').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.reload(); });
$('adminAccessBtn').addEventListener('click', () => $('adminModalBackdrop').classList.remove('hidden'));
$('closeAdminBtn').addEventListener('click', () => $('adminModalBackdrop').classList.add('hidden'));
$('adminLoginForm').addEventListener('submit', async (event) => {
	event.preventDefault();
	const name = $('adminName').value;
	const password = $('adminPassword').value;
	try {
		await api('/api/admin/login', { method: 'POST', headers: { 'X-Admin-Name': name, 'X-Admin-Password': password }, body: JSON.stringify({ name, password }) });
		adminCredentials = { name, password };
		$('adminError').classList.add('hidden');
		$('adminModalBackdrop').classList.add('hidden');
		$('loginPage').classList.add('hidden');
		$('adminPage').classList.remove('hidden');
		await renderAccounts();
	} catch (error) {
		$('adminError').textContent = error.message.includes('Failed to fetch')
			? 'Cannot connect to the backend. Open this app at http://localhost:3000 instead of opening index.html directly.'
			: error.message;
		$('adminError').classList.remove('hidden');
	}
});
$('adminLogoutBtn').addEventListener('click', () => { $('adminPage').classList.add('hidden'); $('loginPage').classList.remove('hidden'); });
$('pickOutfitBtn').addEventListener('click', () => { pickingOutfit = !pickingOutfit; $('pickOutfitBtn').textContent = pickingOutfit ? 'Done picking' : 'Pick an outfit'; $('pickHint').classList.toggle('hidden', !pickingOutfit); renderItems(); });
$('clearPickBtn').addEventListener('click', () => { selectedItemIds = []; updateOutfitTray(); renderItems(); });
$('openModalBtn').addEventListener('click', () => $('modalBackdrop').classList.remove('hidden'));
$('closeModalBtn').addEventListener('click', closeModal);
$('cancelBtn').addEventListener('click', closeModal);
$('modalBackdrop').addEventListener('click', (event) => { if (event.target === $('modalBackdrop')) closeModal(); });
$('searchInput').addEventListener('input', renderItems);
$('categoryFilter').addEventListener('change', renderItems);
$('photoInput').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file || file.size > 5 * 1024 * 1024) return alert('Please choose an image smaller than 5MB.'); const reader = new FileReader(); reader.onload = () => { selectedImage = reader.result; $('preview').src = selectedImage; $('preview').classList.remove('hidden'); $('uploadText').classList.add('hidden'); }; reader.readAsDataURL(file); });
$('itemForm').addEventListener('submit', async (event) => {
	event.preventDefault();
	if (!selectedImage) return;
	try {
		const item = await api('/api/items', { method: 'POST', body: JSON.stringify({ name: $('itemName').value.trim(), category: $('itemCategory').value, image: selectedImage }) });
		items.unshift(item);
		closeModal();
		renderItems();
	} catch (error) { alert(error.message); }
});
init();
