// =============================
// DANH SÁCH BÁO CÁO - INDEXEDDB
// =============================

const DB_NAME = "BaoCaoViPhamDB";
const DB_VERSION = 1;
const STORE_NAME = "baoCao"; // mỗi record: { name: "example.json", content: "<json text>" }

let dbInstance = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "name" });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Lấy toàn bộ danh sách báo cáo
async function getAllReports() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Lấy 1 báo cáo theo tên file
async function getReport(name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(name);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Lưu (tạo mới / ghi đè) 1 báo cáo
async function putReport(name, content) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ name, content });

        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

// Xóa 1 báo cáo
async function deleteReport(name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(name);

        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

// Xóa toàn bộ báo cáo, trả về số lượng đã xóa
async function deleteAllReports() {
    const reports = await getAllReports();
    const db = await openDB();

    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();

        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });

    return reports.length;
}

// ==========================
// TRẠNG THÁI ỨNG DỤNG
// ==========================

// Không còn khái niệm "chọn thư mục" với IndexedDB, dữ liệu luôn sẵn sàng
// sau khi trang được tải. Biến này giữ để tương thích với các đoạn code cũ
// kiểm tra "đã sẵn sàng chưa".
let dbReady = false;

// Tên file (record) hiện đang được chọn trong editor (thay cho currentFileHandle)
let currentFileName = null;

// ==========================
// XÓA TOÀN BỘ DỮ LIỆU BÁO CÁO
// ==========================

document.getElementById('btn-xoa-tat-ca')?.addEventListener('click', async function() {
    if (!dbReady) {
        alert("Dữ liệu chưa sẵn sàng, vui lòng tải lại trang.");
        return;
    }

    const xacNhan = confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử báo cáo hiện tại không?");

    if (!xacNhan) {
        return;
    }

    try {
        const soFileDaXoa = await deleteAllReports();

        // Cập nhật danh sách file
        await renderReportList();

        // Reset file hiện tại
        currentFileName = null;

        document.getElementById("fileName").value = "";
        document.getElementById("jsonInput").value = "";

        alert(`🗑️ Đã xóa ${soFileDaXoa} báo cáo.`);
    } catch (error) {
        console.error(error);
        setStatus("Có lỗi xảy ra khi xóa file JSON.");
    }
});

// ==========================
// HIỂN THỊ DANH SÁCH BÁO CÁO
// ==========================

async function renderReportList() {
    const container = document.getElementById("list-bao-cao-container");
    if (!container) return;

    container.innerHTML = "";

    if (!dbReady) {
        container.innerHTML = '<p class="empty-msg">Chưa chọn thư mục.</p>';
        return;
    }

    let found = false;

    let reports;
    try {
        reports = await getAllReports();
    } catch (error) {
        console.error("Không thể đọc danh sách báo cáo:", error);
        container.innerHTML = '<p class="empty-msg">Có lỗi khi tải dữ liệu.</p>';
        return;
    }

    // Duyệt qua tất cả các báo cáo JSON trong IndexedDB
    for (const record of reports) {
        const { name, content: text } = record;

        // 1. Parse JSON
        let item;
        try {
            item = JSON.parse(text);
        } catch (error) {
            console.error(`Lỗi PARSE JSON ở báo cáo "${name}":`, error);

            found = true;

            const errorCard = document.createElement("div");
            errorCard.className = "report-card";
            errorCard.innerHTML = `
                <div class="report-header">
                    <div class="report-title">
                        ⚠️ <strong>${name}</strong>
                        <span class="report-time">JSON không hợp lệ</span>
                    </div>
                </div>
            `;
            container.appendChild(errorCard);
            continue; // bỏ qua record này, sang record tiếp theo
        }

        // 2. Dựng card hiển thị
        try {
            found = true;

            const card = document.createElement("div");
            card.className = "report-card";

            card.innerHTML = `
                <div class="report-header">
                    <div class="report-title">
                        🏫 <strong>${item.phien?.phong || 'Phòng Học Không Tên'}</strong> 
                        <span class="report-time">⏰ ${item.phien?.thoiDiemKiemTra || 'Chưa rõ thời gian'}</span>
                    </div>
                    <button class="btn-arrow">▼</button>
                </div>

                <div class="report-detail" style="display: none;">
                    <div class="detail-content">
                        <p>
                            <strong>⚡ Thiết bị quên tắt:</strong>
                            ${item.dieuHoaQuenTat || 0} Điều hòa,
                            ${item.quatQuenTat || 0} Quạt/Đèn
                        </p>

                        <p>
                            <strong>📉 Điểm thi đua trừ:</strong>
                            <span class="badge-red">
                                -${item.diemTru || 0} điểm
                            </span>
                        </p>

                        <p>
                            <strong>💰 Ước tính lãng phí:</strong>
                            <span class="badge-green">
                                ${item.langPhiUocTinh || '0 VNĐ'}
                            </span>
                        </p>

                        <p>
                            <strong>📝 Ghi chú từ AI / GV:</strong>
                            ${item.ghiChu || 'Không có ghi chú'}
                        </p>
                    </div>
                </div>
            `;

            // Gán sự kiện trực tiếp vào thẻ header của report-card
            const header = card.querySelector(".report-header");
            header.onclick = async (e) => {
                e.stopPropagation();
                await toggleReportDetail(name, card);
            };

            container.appendChild(card);
        } catch (error) {
            console.error(`Lỗi HIỂN THỊ báo cáo "${name}":`, error);

            const errorCard = document.createElement("div");
            errorCard.className = "report-card";
            errorCard.innerHTML = `
                <div class="report-header">
                    <div class="report-title">
                        ⚠️ <strong>${name}</strong>
                        <span class="report-time">Lỗi khi hiển thị</span>
                    </div>
                </div>
            `;
            container.appendChild(errorCard);
        }
    }

    if (!found) {
        container.innerHTML =
            '<p class="empty-msg">Chưa có dữ liệu báo cáo vi phạm nào được ghi nhận.</p>';
    }
}

async function toggleReportDetail(name, cardElement) {
    const detailEl = cardElement.querySelector(".report-detail");
    const arrowEl = cardElement.querySelector(".btn-arrow");

    // 1. Mở báo cáo lên Editor (chỉ khi Editor tồn tại)
    if (document.getElementById("fileName") && document.getElementById("jsonInput")) {
        try {
            const record = await getReport(name);

            if (!record) {
                setStatus("Không tìm thấy báo cáo.");
                return;
            }

            document.getElementById("fileName").value = name;
            document.getElementById("jsonInput").value = record.content;

            currentFileName = name;

            document.querySelectorAll("#fileList li, .report-card")
                .forEach(el => el.classList.remove("selected"));

            cardElement.classList.add("selected");

            setStatus?.("📄 Đã mở " + name);
        } catch (error) {
            console.error("Không thể mở báo cáo vào editor:", error);
            setStatus?.("Không thể mở file.");
        }
    }

    // 2. Toggle Viewer
    if (detailEl.style.display === "block") {
        detailEl.style.display = "none";
        if (arrowEl) arrowEl.innerText = "▼";
    } else {
        detailEl.style.display = "block";
        if (arrowEl) arrowEl.innerText = "▲";
    }
}

// Khởi tạo IndexedDB ngay khi trang tải, không cần người dùng chọn thư mục
window.onload = async () => {
    try {
        await openDB();
        dbReady = true;
    } catch (error) {
        console.error("Không thể mở IndexedDB:", error);
        alert("Không thể mở cơ sở dữ liệu.");
        setStatus("Không thể mở cơ sở dữ liệu.");
    }
    await renderReportList();
};

// MỞ FILE

async function openFile(name) {
    try {
        const record = await getReport(name);

        if (!record) {
            setStatus("Không tìm thấy báo cáo.");
            return;
        }

        document.getElementById("fileName").value = name;
        document.getElementById("jsonInput").value = record.content;

        currentFileName = name;

        // Xóa trạng thái selected cũ
        document.querySelectorAll("#fileList li")
            .forEach(li => li.classList.remove("selected"));

        setStatus("📄 Đã mở " + name);
    } catch (error) {
        console.error(error);
        setStatus("Không thể mở file.");
    }
}


// FILE MỚI

document.getElementById("newFile")?.addEventListener("click", () => {
    currentFileName = null;

    document.getElementById("fileName").value = "";
    document.getElementById("jsonInput").value =
    `{
        "name": "",
        "value": 0
    }`;

    document.querySelectorAll("#fileList li")
        .forEach(li => li.classList.remove("selected"));

    setStatus("Đang tạo file mới.");
});


// LƯU FILE

document.getElementById("saveFile")?.addEventListener("click", async () => {
    if (!dbReady) {
        alert("Dữ liệu chưa sẵn sàng, vui lòng tải lại trang.");
        return;
    }

    const fileNameInput =
        document.getElementById("fileName");
    const jsonInput =
        document.getElementById("jsonInput");

    let fileName = fileNameInput.value.trim();

    const text = jsonInput.value;


    // Kiểm tra tên
    if (fileName === "") {
        alert("Hãy nhập tên file.");
        return;
    }

    // Tự thêm .json
    if (!fileName.toLowerCase().endsWith(".json")) {
        fileName += ".json";
    }

    // Kiểm tra JSON
    try {
        JSON.parse(text);
    } catch (error) {
        alert("JSON không hợp lệ!\n\n" + error.message);
        return;
    }


    // Tạo / cập nhật record trong IndexedDB
    try {
        await putReport(fileName, text);

        // Cập nhật trạng thái
        currentFileName = fileName;
        fileNameInput.value = fileName;

        await renderReportList();

        setStatus("Đã lưu " + fileName);
    } catch (error) {
        console.error(error);
        alert(
            "Không thể lưu file.\n\n" +
            error.message
        );
    }
});


// XÓA FILE

document.getElementById("deleteFile")?.addEventListener("click", async () => {
    if (!dbReady) {
        alert("Dữ liệu chưa sẵn sàng, vui lòng tải lại trang.");
        return;
    }
    if (!currentFileName) {
        alert("Chưa chọn file.");
        return;
    }
    const fileName =
        document.getElementById("fileName").value;

    const confirmed =
        confirm(`Xóa "${fileName}"?`);

    if (!confirmed) {
        return;
    }

    try {
        await deleteReport(fileName);

        currentFileName = null;

        document.getElementById("fileName").value = "";
        document.getElementById("jsonInput").value = "";

        await renderReportList();

        setStatus("Đã xóa " + fileName);
    } catch (error) {
        console.error(error);
        alert(
            "Không thể xóa file.\n\n" +
            error.message
        );
    }
});


// STATUS (dòng chữ nhỏ ở dưới)

function setStatus(message) {
    document.getElementById("status").textContent =
        message;
}