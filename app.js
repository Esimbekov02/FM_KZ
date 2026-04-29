const KEYS = {
  products: "fm_world_products_v2",
  sales: "fm_world_sales_v2",
  users: "fm_world_users_v2",
  token: "fm_world_jwt_token",
};

const permissions = {
  Seller: {
    manageProducts: false,
    manageStock: false,
    reports: false,
    users: false,
    download: false,
  },
  Admin: {
    manageProducts: true,
    manageStock: true,
    reports: true,
    users: true,
    download: true,
  },
  Supervisor: {
    manageProducts: true,
    manageStock: true,
    reports: true,
    users: false,
    download: true,
  },
};

const seedUsers = [
  { id: "U-001", name: "Администратор", login: "admin", password: "admin123", role: "Admin", blocked: false },
  { id: "U-002", name: "Супервайзер", login: "supervisor", password: "super123", role: "Supervisor", blocked: false },
  { id: "U-003", name: "Продавец", login: "seller", password: "seller123", role: "Seller", blocked: false },
];

const seedProducts = [
  productSeed("PR-900", "Pure Royal 900", "FM World", "Женский аромат", 50, 20, 38, 12),
  productSeed("FM-199", "Federico Mahora 199", "FM World", "Мужской аромат", 50, 18, 34, 8),
  productSeed("UT-RBY", "Utique Ruby", "Utique", "Унисекс", 100, 34, 55, 5),
  productSeed("FM-366", "Federico Mahora 366", "FM World", "Женский аромат", 50, 17, 32, 2),
  productSeed("UT-AMB", "Utique Ambergris", "Utique", "Мужской аромат", 100, 39, 64, 1),
];

let users = load(KEYS.users, seedUsers);
let products = load(KEYS.products, seedProducts);
let sales = load(KEYS.sales, []);
let currentUser = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function productSeed(id, name, brand, category, volume, purchasePrice, salePrice, stock) {
  return {
    id,
    name,
    brand,
    category,
    volume,
    purchasePrice,
    salePrice,
    stock,
    addedAt: new Date().toISOString(),
  };
}

function load(key, fallback) {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : fallback;
}

function save() {
  localStorage.setItem(KEYS.products, JSON.stringify(products));
  localStorage.setItem(KEYS.sales, JSON.stringify(sales));
  localStorage.setItem(KEYS.users, JSON.stringify(users));
}

function makeToken(user) {
  const header = btoa(JSON.stringify({ alg: "demo", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: user.id, role: user.role, login: user.login, iat: Date.now() }));
  return `${header}.${payload}.demo-signature`;
}

function readToken() {
  const token = localStorage.getItem(KEYS.token);
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return users.find((user) => user.id === payload.sub && !user.blocked) || null;
  } catch {
    return null;
  }
}

function can(action) {
  return Boolean(currentUser && permissions[currentUser.role]?.[action]);
}

function showToast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  window.setTimeout(() => $("#toast").classList.remove("show"), 2400);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function startApp(user) {
  currentUser = user;
  $("#loginScreen").classList.add("hidden");
  $("#appShell").classList.remove("hidden");
  $("#currentUserLabel").textContent = `${user.name} · ${user.role}`;
  applyAccess();
  showPage(user.role === "Seller" ? "sale" : "dashboard");
  renderAll();
}

function applyAccess() {
  $$("[data-permission]").forEach((element) => {
    element.classList.toggle("hidden", !can(element.dataset.permission));
  });
  $$(".admin-only").forEach((element) => {
    element.classList.toggle("hidden", !can("manageProducts") && !can("manageStock"));
  });
  $("#productForm").classList.add("hidden");
}

function showPage(page) {
  if ((page === "reports" && !can("reports")) || (page === "users" && !can("users"))) {
    showToast("Нет доступа к разделу");
    return;
  }

  $$(".page").forEach((item) => item.classList.remove("active"));
  $(`#${page}Page`).classList.add("active");
  $$(".nav-link").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderProducts();
  renderSaleForm();
  renderReports();
  renderStock();
  renderUsers();
  save();
}

function renderDashboard() {
  const todaySales = sales.filter((sale) => sale.soldAt.slice(0, 10) === todayIso());
  const lowStock = products.filter((product) => product.stock <= 3);

  $("#todayRevenue").textContent = money.format(sum(todaySales, "total"));
  $("#todaySalesCount").textContent = `${todaySales.length} продаж`;
  $("#totalProducts").textContent = products.length;
  $("#totalStock").textContent = products.reduce((total, product) => total + product.stock, 0);
  $("#todaySold").textContent = todaySales.reduce((total, sale) => total + sale.quantity, 0);
  $("#lowStockCount").textContent = lowStock.length;

  $("#lowStockTable").innerHTML = lowStock.length
    ? lowStock
        .map(
          (product) => `
            <tr>
              <td>${product.id}</td>
              <td><span class="product-name">${escapeHtml(product.name)}</span></td>
              <td>${escapeHtml(product.brand)}</td>
              <td class="low-stock">${product.stock}</td>
              <td>${money.format(product.salePrice)}</td>
            </tr>
          `,
        )
        .join("")
    : emptyRow(5, "Товаров с низким остатком нет");
}

function renderProducts() {
  $("#productsTable").innerHTML = products.length
    ? products.map(productRow).join("")
    : emptyRow(can("manageProducts") ? 10 : 9, "Пока нет товаров");
}

function productRow(product) {
  const actions = can("manageProducts")
    ? `
      <td>
        <button class="mini-btn" type="button" data-edit-product="${product.id}">Ред.</button>
        <button class="danger-btn" type="button" data-delete-product="${product.id}">Удалить</button>
      </td>`
    : "";

  return `
    <tr>
      <td>${product.id}</td>
      <td><span class="product-name">${escapeHtml(product.name)}</span></td>
      <td>${escapeHtml(product.brand)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${product.volume} мл</td>
      <td>${money.format(product.purchasePrice)}</td>
      <td>${money.format(product.salePrice)}</td>
      <td class="${product.stock <= 3 ? "low-stock" : ""}">${product.stock}</td>
      <td>${formatDateTime(product.addedAt)}</td>
      ${actions}
    </tr>
  `;
}

function renderSaleForm() {
  const available = products.filter((product) => product.stock > 0);
  $("#saleProduct").innerHTML = available.length
    ? available
        .map((product) => `<option value="${product.id}">${escapeHtml(product.name)} · ${product.stock} шт.</option>`)
        .join("")
    : `<option value="">Нет товара на складе</option>`;
  $("#saleProduct").disabled = !available.length;
  updateSaleTotal();
}

function updateSaleTotal() {
  const product = products.find((item) => item.id === $("#saleProduct").value);
  const quantity = Number($("#saleQuantity").value || 0);
  $("#saleTotal").textContent = money.format(product ? product.salePrice * quantity : 0);
}

function filteredSales() {
  const dateFrom = $("#reportDateFrom").value;
  const dateTo = $("#reportDateTo").value;
  const seller = $("#reportSeller").value;
  const productId = $("#reportProduct").value;
  const brand = $("#reportBrand").value;

  return sales.filter((sale) => {
    const saleDate = sale.soldAt.slice(0, 10);
    return (
      (!dateFrom || saleDate >= dateFrom) &&
      (!dateTo || saleDate <= dateTo) &&
      (!seller || sale.sellerId === seller) &&
      (!productId || sale.productId === productId) &&
      (!brand || sale.brand === brand)
    );
  });
}

function renderReports() {
  if (!can("reports")) return;

  fillSelect("#reportSeller", users.filter((user) => user.role === "Seller"), "Все продавцы", "id", "name");
  fillSelect("#reportProduct", products, "Все товары", "id", "name");
  fillSelect("#reportBrand", uniqueBrands().map((brand) => ({ id: brand, name: brand })), "Все бренды", "id", "name");

  const data = filteredSales();
  $("#reportTotalRevenue").textContent = money.format(sum(data, "total"));
  $("#reportSoldItems").textContent = data.reduce((total, sale) => total + sale.quantity, 0);
  $("#reportSalesCount").textContent = data.length;
  $("#reportSellerCount").textContent = new Set(data.map((sale) => sale.sellerId)).size;

  $("#reportsTable").innerHTML = data.length
    ? data
        .slice()
        .reverse()
        .map(
          (sale) => `
            <tr>
              <td>${sale.id}</td>
              <td>${formatDateTime(sale.soldAt)}</td>
              <td>${escapeHtml(sale.productName)}</td>
              <td>${escapeHtml(sale.brand)}</td>
              <td>${sale.quantity}</td>
              <td>${money.format(sale.unitPrice)}</td>
              <td>${money.format(sale.total)}</td>
              <td>${escapeHtml(sale.sellerName)}</td>
            </tr>
          `,
        )
        .join("")
    : emptyRow(8, "Продажи не найдены");

  const bySeller = new Map();
  data.forEach((sale) => {
    const current = bySeller.get(sale.sellerName) || { quantity: 0, total: 0 };
    current.quantity += sale.quantity;
    current.total += sale.total;
    bySeller.set(sale.sellerName, current);
  });

  $("#sellerSummaryTable").innerHTML = bySeller.size
    ? Array.from(bySeller.entries())
        .map(([sellerName, value]) => `<tr><td>${escapeHtml(sellerName)}</td><td>${value.quantity}</td><td>${money.format(value.total)}</td></tr>`)
        .join("")
    : emptyRow(3, "Нет данных");
}

function renderStock() {
  $("#stockTable").innerHTML = products.length
    ? products
        .map((product) => {
          const controls = can("manageStock")
            ? `<td><button class="mini-btn" type="button" data-stock-down="${product.id}">-</button><button class="mini-btn add" type="button" data-stock-up="${product.id}">+</button></td>`
            : "";
          return `
            <tr>
              <td><span class="product-name">${escapeHtml(product.name)}</span></td>
              <td>${escapeHtml(product.brand)}</td>
              <td>${product.volume} мл</td>
              <td class="${product.stock <= 3 ? "low-stock" : ""}">${product.stock}</td>
              <td>${money.format(product.salePrice)}</td>
              <td>${money.format(product.salePrice * product.stock)}</td>
              ${controls}
            </tr>
          `;
        })
        .join("")
    : emptyRow(can("manageStock") ? 7 : 6, "Остатков нет");
}

function renderUsers() {
  if (!can("users")) return;

  $("#usersTable").innerHTML = users
    .map(
      (user) => `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.login)}</td>
          <td>${user.role}</td>
          <td>${user.blocked ? "Заблокирован" : "Активен"}</td>
          <td>
            <button class="mini-btn" type="button" data-edit-user="${user.id}">Ред.</button>
            <button class="danger-btn" type="button" data-toggle-user="${user.id}">
              ${user.blocked ? "Разблок." : "Блок."}
            </button>
          </td>
        </tr>
      `,
    )
    .join("");
}

function fillSelect(selector, items, placeholder, valueKey, textKey) {
  const select = $(selector);
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + items.map((item) => `<option value="${item[valueKey]}">${escapeHtml(item[textKey])}</option>`).join("");
  select.value = current;
}

function uniqueBrands() {
  return Array.from(new Set(products.map((product) => product.brand))).sort();
}

function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}

function emptyRow(colspan, text) {
  return `<tr><td class="empty-row" colspan="${colspan}">${text}</td></tr>`;
}

function resetProductForm() {
  $("#productForm").reset();
  $("#productId").value = "";
  $("#productForm").classList.add("hidden");
}

function resetUserForm() {
  $("#userForm").reset();
  $("#userId").value = "";
  $("#userBlocked").value = "false";
}

function exportExcel(filename, rows) {
  const html = `
    <html><head><meta charset="UTF-8"></head><body>
      <table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</table>
    </body></html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

$("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const login = $("#loginInput").value.trim();
  const password = $("#passwordInput").value;
  const user = users.find((item) => item.login === login && item.password === password);

  if (!user) {
    showToast("Неверный логин или пароль");
    return;
  }

  if (user.blocked) {
    showToast("Пользователь заблокирован");
    return;
  }

  localStorage.setItem(KEYS.token, makeToken(user));
  startApp(user);
});

$("#logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(KEYS.token);
  currentUser = null;
  $("#appShell").classList.add("hidden");
  $("#loginScreen").classList.remove("hidden");
});

$("#nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (button) showPage(button.dataset.page);
});

document.body.addEventListener("click", (event) => {
  const quick = event.target.closest(".quick-link");
  if (quick) showPage(quick.dataset.page);
});

$("#openProductFormBtn").addEventListener("click", () => {
  if (!can("manageProducts")) return;
  $("#productForm").classList.remove("hidden");
});

$("#cancelProductFormBtn").addEventListener("click", resetProductForm);

$("#productForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!can("manageProducts")) return;

  const id = $("#productId").value || `P-${String(Date.now()).slice(-6)}`;
  const product = {
    id,
    name: $("#productName").value.trim(),
    brand: $("#productBrand").value.trim(),
    category: $("#productCategory").value.trim(),
    volume: Number($("#productVolume").value),
    purchasePrice: Number($("#productPurchasePrice").value),
    salePrice: Number($("#productSalePrice").value),
    stock: Number($("#productStock").value),
    addedAt: products.find((item) => item.id === id)?.addedAt || new Date().toISOString(),
  };

  products = products.some((item) => item.id === id)
    ? products.map((item) => (item.id === id ? product : item))
    : [...products, product];

  resetProductForm();
  showToast("Товар сохранен");
  renderAll();
});

$("#productsTable").addEventListener("click", (event) => {
  const editId = event.target.dataset.editProduct;
  const deleteId = event.target.dataset.deleteProduct;

  if (editId && can("manageProducts")) {
    const product = products.find((item) => item.id === editId);
    $("#productId").value = product.id;
    $("#productName").value = product.name;
    $("#productBrand").value = product.brand;
    $("#productCategory").value = product.category;
    $("#productVolume").value = product.volume;
    $("#productPurchasePrice").value = product.purchasePrice;
    $("#productSalePrice").value = product.salePrice;
    $("#productStock").value = product.stock;
    $("#productForm").classList.remove("hidden");
  }

  if (deleteId && can("manageProducts")) {
    products = products.filter((item) => item.id !== deleteId);
    showToast("Товар удален");
    renderAll();
  }
});

$("#saleProduct").addEventListener("change", updateSaleTotal);
$("#saleQuantity").addEventListener("input", updateSaleTotal);

$("#saleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const product = products.find((item) => item.id === $("#saleProduct").value);
  const quantity = Number($("#saleQuantity").value);

  if (!product) {
    showToast("Выберите товар");
    return;
  }

  if (quantity > product.stock) {
    showToast(`Недостаточно товара. Остаток: ${product.stock}`);
    return;
  }

  product.stock -= quantity;
  sales.push({
    id: `S-${String(Date.now()).slice(-7)}`,
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    quantity,
    unitPrice: product.salePrice,
    total: product.salePrice * quantity,
    sellerId: currentUser.id,
    sellerName: currentUser.name,
    soldAt: new Date().toISOString(),
  });

  $("#saleQuantity").value = 1;
  showToast("Продажа оформлена");
  renderAll();
});

["#reportDateFrom", "#reportDateTo", "#reportSeller", "#reportProduct", "#reportBrand"].forEach((selector) => {
  $(selector).addEventListener("change", renderReports);
});

$("#downloadSalesReportBtn").addEventListener("click", () => {
  if (!can("download")) return;
  const rows = [
    ["ID продажи", "Дата продажи", "Название товара", "Бренд", "Количество", "Цена за единицу", "Общая сумма", "Продавец"],
    ...filteredSales().map((sale) => [
      sale.id,
      formatDateTime(sale.soldAt),
      sale.productName,
      sale.brand,
      sale.quantity,
      sale.unitPrice,
      sale.total,
      sale.sellerName,
    ]),
  ];
  exportExcel(`fm-world-sales-${todayIso()}.xls`, rows);
});

$("#downloadStockReportBtn").addEventListener("click", () => {
  const rows = [
    ["Название товара", "Бренд", "Объем", "Количество на складе", "Цена продажи", "Общая стоимость остатков"],
    ...products.map((product) => [
      product.name,
      product.brand,
      `${product.volume} мл`,
      product.stock,
      product.salePrice,
      product.salePrice * product.stock,
    ]),
  ];
  exportExcel(`fm-world-stock-${todayIso()}.xls`, rows);
});

$("#stockTable").addEventListener("click", (event) => {
  if (!can("manageStock")) return;
  const upId = event.target.dataset.stockUp;
  const downId = event.target.dataset.stockDown;
  const product = products.find((item) => item.id === (upId || downId));
  if (!product) return;

  product.stock = upId ? product.stock + 1 : Math.max(0, product.stock - 1);
  showToast("Остаток обновлен");
  renderAll();
});

$("#userForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!can("users")) return;

  const id = $("#userId").value || `U-${String(Date.now()).slice(-6)}`;
  const user = {
    id,
    name: $("#userName").value.trim(),
    login: $("#userLogin").value.trim(),
    password: $("#userPassword").value,
    role: $("#userRole").value,
    blocked: $("#userBlocked").value === "true",
  };

  users = users.some((item) => item.id === id)
    ? users.map((item) => (item.id === id ? user : item))
    : [...users, user];

  resetUserForm();
  showToast("Пользователь сохранен");
  renderAll();
});

$("#resetUserFormBtn").addEventListener("click", resetUserForm);

$("#usersTable").addEventListener("click", (event) => {
  const editId = event.target.dataset.editUser;
  const toggleId = event.target.dataset.toggleUser;

  if (editId) {
    const user = users.find((item) => item.id === editId);
    $("#userId").value = user.id;
    $("#userName").value = user.name;
    $("#userLogin").value = user.login;
    $("#userPassword").value = user.password;
    $("#userRole").value = user.role;
    $("#userBlocked").value = String(user.blocked);
  }

  if (toggleId) {
    const user = users.find((item) => item.id === toggleId);
    user.blocked = !user.blocked;
    showToast(user.blocked ? "Пользователь заблокирован" : "Пользователь разблокирован");
    renderAll();
  }
});

const savedUser = readToken();
if (savedUser) {
  startApp(savedUser);
} else {
  $("#loginScreen").classList.remove("hidden");
}
