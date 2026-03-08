document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('tableBody');
    const bulkBar = document.getElementById('bulkBar');
    const countSelected = document.getElementById('countSelected');
    const selectAll = document.getElementById('selectAll');
    const rows = document.querySelectorAll('.history-row');

    const updateBulkUI = () => {
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        const count = checkedBoxes.length;
        
        bulkBar.style.display = count > 0 ? 'flex' : 'none';
        document.getElementById('bulkText').innerText = `${count} BARIS DICENTANG`;
        
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.closest('tr').classList.toggle('row-selected', cb.checked);
        });
    };

    if (tableBody) {
        tableBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('row-checkbox')) updateBulkUI();
        });
    }

    if (selectAll) {
        selectAll.addEventListener('change', () => {
            const visibleCheckboxes = Array.from(document.querySelectorAll('.history-row'))
                .filter(r => r.style.display !== 'none')
                .map(r => r.querySelector('.row-checkbox'));
            
            visibleCheckboxes.forEach(cb => cb.checked = selectAll.checked);
            updateBulkUI();
        });
    }

    const updateSummary = () => {
        let tMatang = 0, tMentah = 0, tBunga = 0;
        const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');

        visibleRows.forEach(row => {
            tMatang += parseInt(row.querySelector('.raw-matang').innerText) || 0;
            tMentah += parseInt(row.querySelector('.raw-mentah').innerText) || 0;
            tBunga += parseInt(row.querySelector('.raw-bunga').innerText) || 0;
        });

        if (countSelected) countSelected.innerText = visibleRows.length;
        if (document.getElementById('sumMatang')) document.getElementById('sumMatang').innerText = tMatang;
        if (document.getElementById('sumMentah')) document.getElementById('sumMentah').innerText = tMentah;
        if (document.getElementById('sumBunga')) document.getElementById('sumBunga').innerText = tBunga;
    };

    const filterData = () => {
        const searchInput = document.getElementById('searchInput');
        const dateInput = document.getElementById('dateInput');
        const statusFilter = document.getElementById('statusFilter');

        const searchText = searchInput ? searchInput.value.toLowerCase() : '';
        const searchDate = dateInput ? dateInput.value : '';
        const statusType = statusFilter ? statusFilter.value : '';

        rows.forEach(row => {
            const idMatch = row.innerText.toLowerCase().includes(searchText);
            const dateMatch = !searchDate || row.getAttribute('data-date') === searchDate;
            
            const statusBadge = row.querySelector('.col-status');
            const statusMatch = !statusType || (statusBadge && statusBadge.innerText.includes(statusType));
            
            row.style.display = (idMatch && dateMatch && statusMatch) ? '' : 'none';
        });
        
        if (selectAll) selectAll.checked = false;
        document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
        updateBulkUI();
        updateSummary();
    };

    ['searchInput', 'dateInput', 'statusFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', filterData);
    });

    const btnResetFilter = document.getElementById('btnResetFilter');
    if (btnResetFilter) {
        btnResetFilter.addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            document.getElementById('dateInput').value = '';
            document.getElementById('statusFilter').value = '';
            filterData();
        });
    }

    updateSummary();
});

window.bukaDetail = function(btn) {
    // Ambil data dari atribut HTML tombol
    const id = btn.getAttribute('data-id');
    const tanggal = btn.getAttribute('data-tanggal');
    const matang = parseInt(btn.getAttribute('data-matang')) || 0;
    const mentah = parseInt(btn.getAttribute('data-mentah')) || 0;
    const bunga = parseInt(btn.getAttribute('data-bunga')) || 0;

    // Isi ke Pop-Up
    document.getElementById('detId').innerText = "#" + id;
    document.getElementById('detTanggal').innerText = "Waktu Terbang: " + tanggal;
    document.getElementById('detMatang').innerText = matang;
    document.getElementById('detMentah').innerText = mentah;
    document.getElementById('detBunga').innerText = bunga;

    const total = matang + mentah + bunga;
    document.getElementById('detTotal').innerText = total + " Buah";
    document.getElementById('detBerat').innerText = ((matang * 15) / 1000).toFixed(2) + " Kg";

    const persen = total > 0 ? Math.round((matang / total) * 100) : 0;
    document.getElementById('detPersenText').innerText = persen + "%";
    
    // Animasi Progress Bar
    const bar = document.getElementById('detProgressBar');
    bar.style.width = "0%";
    setTimeout(() => { bar.style.width = persen + "%"; }, 100);

    // Warna Bar & Saran
    const box = document.getElementById('detSaranBox');
    const txt = document.getElementById('detSaranText');
    const icon = document.getElementById('detSaranIcon');
    const iconAI = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>`;
    icon.innerHTML = iconAI;

    if (persen >= 40) {
        box.style.background = "#ECFDF5"; box.style.color = "#047857"; bar.style.background = "#10B981";
        txt.innerHTML = "Sistem merekomendasikan <b>panen hari ini</b>.";
    } else if (persen >= 20) {
        box.style.background = "#FFFBEB"; box.style.color = "#B45309"; bar.style.background = "#F59E0B";
        txt.innerHTML = "Lahan dalam fase <b>transisi pematangan</b>.";
    } else {
        box.style.background = "#FFF1F2"; box.style.color = "#BE123C"; bar.style.background = "#E11D48";
        txt.innerHTML = "Tunda panen. Fokus pada perawatan lahan.";
    }

    document.getElementById('modalDetail').classList.add('active');
};

// --- FUNGSI HAPUS DAN EXPORT ---
window.deleteSingle = async function(id) {
    const result = await Swal.fire({ 
        title: 'Buang baris ini?', 
        text: 'Data yang dibuang tidak bisa dikembalikan.',
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#E11D48',
        cancelButtonColor: '#94A3B8',
        confirmButtonText: 'Ya, Buang',
        cancelButtonText: 'Batal'
    });
    if (result.isConfirmed) {
        const res = await fetch(`/api/delete_session/${id}`, { method: 'DELETE' });
        if ((await res.json()).status === 'success') location.reload();
    }
};

window.handleBulkDelete = async function() {
    const ids = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);
    const result = await Swal.fire({ 
        title: `Buang ${ids.length} data?`, 
        text: "Semua baris yang dicentang akan hilang selamanya.", 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#E11D48',
        cancelButtonColor: '#94A3B8',
        confirmButtonText: 'Buang Semua',
        cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
        for (let id of ids) { await fetch(`/api/delete_session/${id}`, { method: 'DELETE' }); }
        location.reload();
    }
};

window.exportSelected = function() {
    const checkedRows = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.closest('tr'));
    const dataArray = [['Kode Laporan', 'Jam Mulai', 'Jam Selesai', 'Buah Merah', 'Buah Hijau', 'Baru Berbunga', 'Kondisi']];
    checkedRows.forEach(row => {
        const cols = row.querySelectorAll('td');
        dataArray.push([cols[1].innerText, cols[2].innerText, cols[3].innerText, cols[4].innerText, cols[5].innerText, cols[6].innerText, cols[7].innerText]);
    });
    const ws = XLSX.utils.aoa_to_sheet(dataArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan_Panen");
    XLSX.writeFile(wb, "Buku_Laporan_Panen_Sebagian.xlsx");
};

window.exportToExcel = function() {
    const rows = document.querySelectorAll('.history-row');
    let dataArray = [['Kode Laporan', 'Jam Mulai', 'Jam Selesai', 'Buah Merah', 'Buah Hijau', 'Baru Berbunga', 'Kondisi']];
    rows.forEach(row => {
        if(row.style.display !== 'none') {
            const cols = row.querySelectorAll('td');
            dataArray.push([cols[1].innerText, cols[2].innerText, cols[3].innerText, cols[4].innerText, cols[5].innerText, cols[6].innerText, cols[7].innerText]);
        }
    });
    const ws = XLSX.utils.aoa_to_sheet(dataArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan_Panen");
    XLSX.writeFile(wb, "Buku_Laporan_Panen_Lengkap.xlsx");
};