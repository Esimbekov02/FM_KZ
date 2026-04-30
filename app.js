const KEYS = {
  products: "fm_world_products_v2",
  sales: "fm_world_sales_v2",
  users: "fm_world_users_v2",
  token: "fm_world_jwt_token",
  warehouse: "fm_world_active_warehouse",
};

const permissions = {
  Seller: {
    createProducts: true,
    manageProducts: false,
    manageStock: false,
    reports: false,
    users: false,
    download: false,
  },
  Admin: {
    createProducts: true,
    manageProducts: true,
    manageStock: true,
    reports: true,
    users: true,
    download: true,
  },
  Supervisor: {
    createProducts: true,
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
  productSeed("PR-900", "Pure Royal 900", "FM World", "Женский аромат", 50, 18000, 8, 4),
  productSeed("FM-199", "Federico Mahora 199", "FM World", "Мужской аромат", 50, 16500, 5, 3),
  productSeed("UT-RBY", "Utique Ruby", "Utique", "Унисекс", 100, 26000, 3, 2),
  productSeed("FM-366", "Federico Mahora 366", "FM World", "Женский аромат", 50, 15500, 1, 1),
  productSeed("UT-AMB", "Utique Ambergris", "Utique", "Мужской аромат", 100, 31000, 1, 0),
];

let users = load(KEYS.users, seedUsers);
let products = load(KEYS.products, seedProducts);
let sales = load(KEYS.sales, []);
let currentUser = null;
let activeWarehouse = localStorage.getItem(KEYS.warehouse) || "showroom";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "KZT",
  maximumFractionDigits: 0,
});

function productSeed(id, name, brand, category, volume, salePrice, showroomStock, officeStock) {
  return {
    id,
    name,
    brand,
    category,
    volume,
    salePrice,
    showroomStock,
    officeStock,
    addedAt: new Date().toISOString(),
  };
}

function normalizeProduct(product) {
  if (product.showroomStock !== undefined && product.officeStock !== undefined) {
    return product;
  }

  return {
    ...product,
    showroomStock: Number(product.stock || 0),
    officeStock: 0,
  };
}

products = products.map(normalizeProduct);

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

function totalStock(product) {
  return Number(product.showroomStock || 0) + Number(product.officeStock || 0);
}

function warehouseLabel(value) {
  return value === "office" ? "Office" : "Островок";
}

function warehouseStock(product, warehouse) {
  return warehouse === "office" ? product.officeStock : product.showroomStock;
}

function activeWarehouseStock(product) {
  return warehouseStock(product, activeWarehouse);
}

function activeWarehouseField() {
  return activeWarehouse === "office" ? "officeStock" : "showroomStock";
}

function warehouseProducts() {
  return products.filter((product) => activeWarehouseStock(product) > 0);
}

function setActiveWarehouse(warehouse) {
  activeWarehouse = warehouse;
  localStorage.setItem(KEYS.warehouse, warehouse);
  $("#activeWarehouse").value = warehouse;
  renderAll();
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
  $("#activeWarehouse").value = activeWarehouse;
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
  const todaySales = sales.filter((sale) => sale.soldAt.slice(0, 10) === todayIso() && (sale.warehouse || "showroom") === activeWarehouse);
  const currentProducts = warehouseProducts();
  const lowStock = currentProducts.filter((product) => activeWarehouseStock(product) <= 3);

  $("#todayRevenue").textContent = money.format(sum(todaySales, "total"));
  $("#todaySalesCount").textContent = `${todaySales.length} продаж`;
  $("#totalProducts").textContent = currentProducts.length;
  $("#activeStockLabel").textContent = `На складе ${warehouseLabel(activeWarehouse)}`;
  $("#activeStock").textContent = currentProducts.reduce((total, product) => total + activeWarehouseStock(product), 0);
  $("#activeWarehouseLabel").textContent = warehouseLabel(activeWarehouse);
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
              <td class="low-stock">${activeWarehouseStock(product)}</td>
              <td>${money.format(product.salePrice)}</td>
            </tr>
          `,
        )
        .join("")
    : emptyRow(5, "Товаров с низким остатком нет");
}

function renderProducts() {
  const currentProducts = warehouseProducts();

  $("#productsTable").innerHTML = currentProducts.length
    ? currentProducts.map(productRow).join("")
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
      <td>${money.format(product.salePrice)}</td>
      <td class="${activeWarehouseStock(product) <= 3 ? "low-stock" : ""}">${activeWarehouseStock(product)}</td>
      <td>${formatDateTime(product.addedAt)}</td>
      ${actions}
    </tr>
  `;
}

function renderSaleForm() {
  const available = products.filter((product) => activeWarehouseStock(product) > 0);
  $("#saleProduct").innerHTML = available.length
    ? available
        .map(
          (product) =>
            `<option value="${product.id}">${escapeHtml(product.name)} · ${warehouseLabel(activeWarehouse)} ${activeWarehouseStock(product)} шт.</option>`,
        )
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
              <td>${warehouseLabel(sale.warehouse)}</td>
              <td>${sale.quantity}</td>
              <td>${money.format(sale.unitPrice)}</td>
              <td>${money.format(sale.total)}</td>
              <td>${escapeHtml(sale.sellerName)}</td>
            </tr>
          `,
        )
        .join("")
    : emptyRow(9, "Продажи не найдены");

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
  const currentProducts = warehouseProducts();

  $("#stockTable").innerHTML = currentProducts.length
    ? currentProducts
        .map((product) => {
          const controls = can("manageStock")
            ? `<td><button class="mini-btn" type="button" data-stock-down="${product.id}">-</button><button class="mini-btn add" type="button" data-stock-up="${product.id}">+</button></td>`
            : "";
          return `
            <tr>
              <td><span class="product-name">${escapeHtml(product.name)}</span></td>
              <td>${escapeHtml(product.brand)}</td>
              <td>${product.volume} мл</td>
              <td>${warehouseLabel(activeWarehouse)}</td>
              <td class="${activeWarehouseStock(product) <= 3 ? "low-stock" : ""}">${activeWarehouseStock(product)}</td>
              <td>${money.format(product.salePrice)}</td>
              <td>${money.format(product.salePrice * activeWarehouseStock(product))}</td>
              ${controls}
            </tr>
          `;
        })
        .join("")
    : emptyRow(can("manageStock") ? 8 : 7, "Остатков нет");
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

$("#activeWarehouse").addEventListener("change", (event) => {
  setActiveWarehouse(event.target.value);
  showToast(`Выбран склад ${warehouseLabel(activeWarehouse)}`);
});

document.body.addEventListener("click", (event) => {
  const quick = event.target.closest(".quick-link");
  if (quick) showPage(quick.dataset.page);
});

$("#openProductFormBtn").addEventListener("click", () => {
  if (!can("createProducts")) return;
  resetProductForm();
  $("#productForm").classList.remove("hidden");
});

$("#cancelProductFormBtn").addEventListener("click", resetProductForm);

$("#productForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!can("createProducts")) return;

  const id = $("#productId").value || `P-${String(Date.now()).slice(-6)}`;
  const existingProduct = products.find((item) => item.id === id);
  if (existingProduct && !can("manageProducts")) {
    showToast("Нет доступа к редактированию товара");
    return;
  }
  const productStock = Number($("#productWarehouseStock").value);
  const product = {
    id,
    name: $("#productName").value.trim(),
    brand: $("#productBrand").value.trim(),
    category: $("#productCategory").value.trim(),
    volume: Number($("#productVolume").value),
    salePrice: Number($("#productSalePrice").value),
    showroomStock: activeWarehouse === "showroom" ? productStock : Number(existingProduct?.showroomStock || 0),
    officeStock: activeWarehouse === "office" ? productStock : Number(existingProduct?.officeStock || 0),
    addedAt: existingProduct?.addedAt || new Date().toISOString(),
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
    $("#productSalePrice").value = product.salePrice;
    $("#productWarehouseStock").value = activeWarehouseStock(product);
    $("#productForm").classList.remove("hidden");
  }

  if (deleteId && can("manageProducts")) {
    const product = products.find((item) => item.id === deleteId);
    if (product) {
      product[activeWarehouseField()] = 0;
    }
    showToast(`Товар удален из склада ${warehouseLabel(activeWarehouse)}`);
    renderAll();
  }
});

$("#saleProduct").addEventListener("change", updateSaleTotal);
$("#saleQuantity").addEventListener("input", updateSaleTotal);

$("#saleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const product = products.find((item) => item.id === $("#saleProduct").value);
  const quantity = Number($("#saleQuantity").value);
  const warehouse = activeWarehouse;

  if (!product) {
    showToast("Выберите товар");
    return;
  }

  if (quantity > warehouseStock(product, warehouse)) {
    showToast(`Недостаточно товара в ${warehouseLabel(warehouse)}. Остаток: ${warehouseStock(product, warehouse)}`);
    return;
  }

  if (warehouse === "office") {
    product.officeStock -= quantity;
  } else {
    product.showroomStock -= quantity;
  }

  sales.push({
    id: `S-${String(Date.now()).slice(-7)}`,
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    warehouse,
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
    ["ID продажи", "Дата продажи", "Название товара", "Бренд", "Склад", "Количество", "Цена за единицу", "Общая сумма", "Продавец"],
    ...filteredSales().map((sale) => [
      sale.id,
      formatDateTime(sale.soldAt),
      sale.productName,
      sale.brand,
      warehouseLabel(sale.warehouse),
      sale.quantity,
      sale.unitPrice,
      sale.total,
      sale.sellerName,
    ]),
  ];
  exportExcel(`fm-world-sales-${todayIso()}.xls`, rows);
});

$("#downloadStockReportBtn").addEventListener("click", () => {
  const currentProducts = warehouseProducts();
  const rows = [
    ["Склад", "Название товара", "Бренд", "Объем", "Количество", "Цена продажи", "Общая стоимость остатков"],
    ...currentProducts.map((product) => [
      warehouseLabel(activeWarehouse),
      product.name,
      product.brand,
      `${product.volume} мл`,
      activeWarehouseStock(product),
      product.salePrice,
      product.salePrice * activeWarehouseStock(product),
    ]),
  ];
  exportExcel(`fm-world-${activeWarehouse}-stock-${todayIso()}.xls`, rows);
});

$("#stockTable").addEventListener("click", (event) => {
  if (!can("manageStock")) return;
  const upValue = event.target.dataset.stockUp;
  const downValue = event.target.dataset.stockDown;
  const productId = upValue || downValue;
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  const field = activeWarehouseField();
  product[field] = upValue ? product[field] + 1 : Math.max(0, product[field] - 1);
  showToast(`Остаток ${warehouseLabel(activeWarehouse)} обновлен`);
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
