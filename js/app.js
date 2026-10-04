const accountsKey = 'closetly-accounts';
const sessionKey = 'closetly-session';
const adminName = 'admin';
const adminPassword = 'admin123';
const categories = {
	Male: ['Shirts', 'T-shirts', 'Pants', 'Jeans', 'Shorts', 'Suits', 'Shoes', 'Accessories'],
	Female: ['Tops', 'Dresses', 'Skirts', 'Jeans', 'Trousers', 'Outerwear', 'Shoes', 'Handbags', 'Accessories']
};
let accounts = JSON.parse(localStorage.getItem(accountsKey) || '[]');
let profile = JSON.parse(localStorage.getItem(sessionKey) || 'null');
let items = [];
let selectedItemIds = [];
let pickingOutfit = false;
let selectedImage = '';
let authMode = 'login';
const $ = (id) => document.getElementById(id);

function saveAccounts() { localStorage.setItem(accountsKey, JSON.stringify(accounts)); }
function saveProfile() { profile.items = items; accounts = accounts.map((account) => account.id === profile.id ? profile : account); saveAccounts(); localStorage.setItem(sessionKey, JSON.stringify(profile)); }
function setCategories() { const options = categories[profile.gender]; $('categoryFilter').innerHTML = '<option value="All">All categories</option>' + options.map((category) => '<option>' + category + '</option>').join(''); $('itemCategory').innerHTML = '<option value="" disabled selected>Choose a category</option>' + options.map((category) => '<option>' + category + '</option>').join(''); }

function showApp() {
	$('loginPage').classList.add('hidden');
	$('adminPage').classList.add('hidden');
	$('app').classList.remove('hidden');
	$('userLabel').textContent = profile.name + ' · ' + profile.gender;
	$('avatar').textContent = profile.name.charAt(0).toUpperCase();
	$('welcomeTitle').textContent = 'Hello, ' + profile.name + '.';
	$('wardrobeSubtitle').textContent = 'A calm little home for everything you love to wear.';
	items = profile.items || [];
	setCategories();
	renderItems();
}

function renderItems() {
	const query = $('searchInput').value.toLowerCase();
	const category = $('categoryFilter').value;
	const visibleItems = items.filter((item) => (category === 'All' || item.category === category) && item.name.toLowerCase().includes(query));
	$('closetGrid').innerHTML = visibleItems.length ? visibleItems.map((item) => '<article class="item-card ' + (pickingOutfit ? 'selectable ' : '') + (selectedItemIds.includes(item.id) ? 'selected' : '') + '" data-item-id="' + item.id + '"><button class="delete-btn" data-id="' + item.id + '" type="button" aria-label="Delete ' + item.name + '">&times;</button><img class="item-image" src="' + item.image + '" alt="' + item.name + '"><div class="item-info"><strong>' + item.name + '</strong><span>' + item.category + '</span></div></article>').join('') : '<div class="empty"><strong>Your closet is waiting.</strong>Add your first clothing photo to start seeing your style at a glance.</div>';
	$('totalCount').textContent = items.length;
	$('categoryCount').textContent = new Set(items.map((item) => item.category)).size;
	const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	$('latestCount').textContent = items.filter((item) => item.createdAt > weekAgo).length;
	document.querySelectorAll('.delete-btn').forEach((button) => button.addEventListener('click', () => { items = items.filter((item) => item.id !== button.dataset.id); selectedItemIds = selectedItemIds.filter((id) => id !== button.dataset.id); saveProfile(); renderItems(); }));
	document.querySelectorAll('.item-card.selectable').forEach((card) => card.addEventListener('click', (event) => { if (event.target.closest('.delete-btn')) return; const id = card.dataset.itemId; selectedItemIds = selectedItemIds.includes(id) ? selectedItemIds.filter((selectedId) => selectedId !== id) : [...selectedItemIds, id]; renderItems(); }));
	updateOutfitTray();
}

function updateOutfitTray() {
	const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));
	$('outfitTray').classList.toggle('hidden', !selectedItems.length);
	$('outfitCount').textContent = selectedItems.length + (selectedItems.length === 1 ? ' piece selected' : ' pieces selected');
	$('outfitItems').innerHTML = selectedItems.map((item) => '<div class="outfit-piece"><img class="outfit-thumb" src="' + item.image + '" alt="' + item.name + '"><div><strong>' + item.name + '</strong><span>' + item.category + '</span></div></div>').join('');
}

function closeModal() { $('modalBackdrop').classList.add('hidden'); $('itemForm').reset(); $('preview').classList.add('hidden'); $('uploadText').classList.remove('hidden'); selectedImage = ''; }
function showAdmin() { $('loginPage').classList.add('hidden'); $('app').classList.add('hidden'); $('adminPage').classList.remove('hidden'); renderAccounts(); }
function setAuthMode(mode) {
	authMode = mode;
	const creating = mode === 'create';
	$('loginTitle').textContent = creating ? 'Create your account' : 'Log in to your wardrobe';
	$('loginDescription').textContent = creating ? 'Create an account to keep your wardrobe private on this browser.' : 'Use your user ID and password to continue.';
	$('name').previousElementSibling.textContent = creating ? 'Your name' : 'User ID';
	$('genderField').classList.toggle('hidden', !creating);
	$('genderField').querySelectorAll('input').forEach((input) => { input.required = creating && input.value === 'Male'; });
	$('authSubmitBtn').textContent = creating ? 'Create account' : 'Log in';
	$('loginModeBtn').classList.toggle('active', !creating);
	$('createModeBtn').classList.toggle('active', creating);
	$('loginModeBtn').setAttribute('aria-selected', String(!creating));
	$('createModeBtn').setAttribute('aria-selected', String(creating));
}
function renderAccounts() {
	$('accountCount').textContent = accounts.length + (accounts.length === 1 ? ' account' : ' accounts');
	$('accountList').innerHTML = accounts.length ? accounts.map((account) => '<div class="account-row"><div class="account-details"><strong>' + account.name + '</strong><span>' + account.gender + ' · ' + (account.items || []).length + ' clothing items</span></div><div class="account-actions"><span class="status-label ' + (account.active === false ? 'disabled' : '') + '">' + (account.active === false ? 'Disabled' : 'Active') + '</span><button class="secondary-btn account-toggle" data-id="' + account.id + '" type="button">' + (account.active === false ? 'Activate' : 'Disable') + '</button><button class="secondary-btn account-reset" data-id="' + account.id + '" type="button">Reset password</button><button class="danger-btn account-delete" data-id="' + account.id + '" type="button">Delete</button></div></div>').join('') : '<div class="empty"><strong>No accounts yet.</strong>User accounts will appear here.</div>';
	document.querySelectorAll('.account-toggle').forEach((button) => button.addEventListener('click', () => { accounts = accounts.map((account) => account.id === button.dataset.id ? { ...account, active: account.active === false } : account); saveAccounts(); renderAccounts(); }));
	document.querySelectorAll('.account-reset').forEach((button) => button.addEventListener('click', () => { const temporaryPassword = 'closet-' + Math.random().toString(36).slice(2, 8); accounts = accounts.map((account) => account.id === button.dataset.id ? { ...account, password: temporaryPassword } : account); saveAccounts(); const account = accounts.find((item) => item.id === button.dataset.id); alert('Temporary password for ' + account.name + ': ' + temporaryPassword + '\nGive it to the user securely.'); }));
	document.querySelectorAll('.account-delete').forEach((button) => button.addEventListener('click', () => { accounts = accounts.filter((account) => account.id !== button.dataset.id); saveAccounts(); renderAccounts(); }));
}

if (profile) showApp();
$('loginForm').addEventListener('submit', (event) => { event.preventDefault(); const name = $('name').value.trim(); const password = $('password').value; const existing = accounts.find((account) => account.name.toLowerCase() === name.toLowerCase()); if (authMode === 'create') { const gender = document.querySelector('input[name="gender"]:checked')?.value; if (existing) return alert('That user ID already exists. Please log in or choose another one.'); const newAccount = { id: Date.now().toString(), name, password, gender, active: true, items: [] }; accounts.push(newAccount); saveAccounts(); $('loginForm').reset(); setAuthMode('login'); alert('Account created. Please log in to continue.'); return; } if (!existing || existing.password !== password) return alert('Incorrect user ID or password. Please try again.'); if (existing.active === false) return alert('This account has been disabled by the admin.'); profile = existing; localStorage.setItem(sessionKey, JSON.stringify(profile)); showApp(); });
$('loginModeBtn').addEventListener('click', () => setAuthMode('login'));
$('createModeBtn').addEventListener('click', () => setAuthMode('create'));
$('logoutBtn').addEventListener('click', () => { localStorage.removeItem(sessionKey); location.reload(); });
$('adminAccessBtn').addEventListener('click', () => $('adminModalBackdrop').classList.remove('hidden'));
$('closeAdminBtn').addEventListener('click', () => $('adminModalBackdrop').classList.add('hidden'));
$('adminLoginForm').addEventListener('submit', (event) => { event.preventDefault(); if ($('adminName').value === adminName && $('adminPassword').value === adminPassword) { $('adminError').classList.add('hidden'); $('adminModalBackdrop').classList.add('hidden'); showAdmin(); } else $('adminError').classList.remove('hidden'); });
$('adminLogoutBtn').addEventListener('click', () => { $('adminPage').classList.add('hidden'); $('loginPage').classList.remove('hidden'); });
$('pickOutfitBtn').addEventListener('click', () => { pickingOutfit = !pickingOutfit; $('pickOutfitBtn').textContent = pickingOutfit ? 'Done picking' : 'Pick an outfit'; $('pickHint').classList.toggle('hidden', !pickingOutfit); renderItems(); if (!pickingOutfit && selectedItemIds.length) $('outfitTray').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
$('clearPickBtn').addEventListener('click', () => { selectedItemIds = []; updateOutfitTray(); renderItems(); });
$('openModalBtn').addEventListener('click', () => $('modalBackdrop').classList.remove('hidden'));
$('closeModalBtn').addEventListener('click', closeModal);
$('cancelBtn').addEventListener('click', closeModal);
$('modalBackdrop').addEventListener('click', (event) => { if (event.target === $('modalBackdrop')) closeModal(); });
$('searchInput').addEventListener('input', renderItems);
$('categoryFilter').addEventListener('change', renderItems);
$('photoInput').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file || file.size > 5 * 1024 * 1024) { alert('Please choose an image smaller than 5MB.'); return; } const reader = new FileReader(); reader.onload = () => { selectedImage = reader.result; $('preview').src = selectedImage; $('preview').classList.remove('hidden'); $('uploadText').classList.add('hidden'); }; reader.readAsDataURL(file); });
$('itemForm').addEventListener('submit', (event) => { event.preventDefault(); if (!selectedImage) return; items.unshift({ id: Date.now().toString(), name: $('itemName').value.trim(), category: $('itemCategory').value, image: selectedImage, createdAt: Date.now() }); saveProfile(); closeModal(); renderItems(); });
