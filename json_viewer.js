let folderHandle = null;
let currentFileHandle = null;

// CHỌN THƯ MỤC

document.getElementById("chooseFolder").onclick = async () => {
    try {
        folderHandle = await window.showDirectoryPicker();
        currentFileHandle = null;
        await refreshFileList();
        setStatus("📁 Đã chọn thư mục.");
    } catch (error) {
        // Người dùng bấm Cancel hoặc lỗi gì đó idk
        console.log(error);
    }
};

// Mảng lưu trữ danh sách file báo cáo để phục vụ truy xuất đồng bộ
let dsBaoCaoHandles = [];

// ==========================
// HIỂN THỊ DANH SÁCH BÁO CÁO
// ==========================

async function renderReportList() {
    const container = document.getElementById("list-bao-cao-container");
    if (!container) return;

    container.innerHTML = "";

    if (!folderHandle) {
        container.innerHTML = '<p class="empty-msg">Chưa chọn thư mục.</p>';
        return;
    }

    let found = false;

    // Duyệt qua tất cả các file JSON trong thư mục
    for await (const [name, handle] of folderHandle.entries()) {
        if (
            handle.kind === "file" &&
            name.toLowerCase().endsWith(".json")
        ) {
            try {
                const file = await handle.getFile();
                const text = await file.text();
                const item = JSON.parse(text);

                found = true;

                const card = document.createElement("div");
                card.className = "report-card";

                card.innerHTML = `
                    <div class="report-header">
                        <div class="report-title">
                            🏫 <strong>${item.phien.phong || 'Phòng Học Không Tên'}</strong> 
                            <span class="report-time">⏰ ${item.phien.thoiDiemKiemTra || 'Chưa rõ thời gian'}</span>
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
                    await toggleReportDetail(handle, name, card);
                };

                container.appendChild(card);
            } catch (error) {
                console.error(`Không thể mở hoặc parse file ${name}:`, error);
            }
        }
    }

    if (!found) {
        container.innerHTML =
            '<p class="empty-msg">Chưa có dữ liệu báo cáo vi phạm nào được ghi nhận.</p>';
    }
}

async function toggleReportDetail(handle, name, cardElement) {
    const detailEl = cardElement.querySelector(".report-detail");
    const arrowEl = cardElement.querySelector(".btn-arrow");

    if (detailEl.style.display === "block") {
        detailEl.style.display = "none";
        if (arrowEl) arrowEl.innerText = "▼";
    } else {
        detailEl.style.display = "block";
        if (arrowEl) arrowEl.innerText = "▲";
    }
}

// Giữ nguyên tương thích tên hàm cũ (tôi lười đổi tên)
async function refreshFileList() {
    await renderReportList();
}

window.onload = renderReportList;

// STATUS (dòng chữ nhỏ ở dưới)

function setStatus(message) {
    document.getElementById("status").textContent =
        message;
}