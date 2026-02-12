async function uploadImage() {
    const imageInput = document.getElementById('imageInput');
    const resultImg = document.getElementById('resultImg');
    const loading = document.getElementById('loading');

    if (imageInput.files.length === 0) return alert("Pilih gambar dulu!");

    const formData = new FormData();
    formData.append('file', imageInput.files[0]);

    // Tampilkan loading, sembunyikan gambar lama
    loading.classList.remove('hidden');
    resultImg.classList.add('hidden');

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        // Tampilkan Gambar Hasil dari Backend
        resultImg.src = "data:image/jpeg;base64," + data.image_data;
        resultImg.classList.remove('hidden');
        loading.classList.add('hidden');
        
    } catch (error) {
        console.error("Error:", error);
        loading.classList.add('hidden');
        alert("Gagal memproses gambar.");
    }
}