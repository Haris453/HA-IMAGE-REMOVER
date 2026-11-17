
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const previewImage = document.getElementById("previewImage");
const imageStatus = document.getElementById("imageStatus");
const removeBgBtn = document.getElementById("removeBgBtn");
const downloadOriginalBtn = document.getElementById("downloadOriginalBtn");
const downloadProcessedBtn = document.getElementById("downloadProcessedBtn");
const removeBtn = document.getElementById("removeBtn");

const imageWidth = document.getElementById("imageWidth");
const imageHeight = document.getElementById("imageHeight");
const resizeBtn = document.getElementById("resizeBtn");
const cropBtn = document.getElementById("cropBtn");
const editStatus = document.getElementById("editStatus");

const API_URL = "http://localhost:5000";

let originalURL = "";
let processedURL = "";
let editedImageURL = "";
let imageName = "HA-Image";

// Select image
fileInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        alert("Please select JPG, PNG or WEBP.");
        fileInput.value = "";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert("Image size must be less than 10 MB.");
        fileInput.value = "";
        return;
    }

    clearProcessedImage();

    if (originalURL) URL.revokeObjectURL(originalURL);

    originalURL = URL.createObjectURL(file);
    imageName = file.name.replace(/\.[^/.]+$/, "");

    previewImage.src = originalURL;
    preview.style.display = "block";

    imageStatus.textContent = "Image uploaded successfully.";
    editStatus.textContent = "Choose width and height to resize your image.";

    removeBgBtn.disabled = false;
    downloadOriginalBtn.disabled = false;
    downloadProcessedBtn.disabled = true;

    preview.scrollIntoView({ behavior: "smooth" });
});

// Remove background
removeBgBtn.addEventListener("click", async function () {
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select an image first.");
        return;
    }

    removeBgBtn.disabled = true;
    removeBgBtn.textContent = "Processing...";
    imageStatus.textContent = "Removing background. Please wait...";

    try {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`${API_URL}/api/upload`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Image processing failed.");
        }

        if (!result.jobId) {
            throw new Error("Server did not return a job ID.");
        }

        const downloadResponse = await fetch(
            `${API_URL}/api/jobs/${result.jobId}/download`
        );

        if (!downloadResponse.ok) {
            throw new Error("Could not download processed image.");
        }

        const imageBlob = await downloadResponse.blob();

        clearProcessedImage();

        processedURL = URL.createObjectURL(imageBlob);
        previewImage.src = processedURL;

        downloadProcessedBtn.disabled = false;
        imageStatus.textContent = "Background removed successfully!";

    } catch (error) {
        console.error("Background removal error:", error);
        imageStatus.textContent = "Error: " + error.message;
        alert("Background removal failed: " + error.message);

    } finally {
        removeBgBtn.disabled = false;
        removeBgBtn.textContent = "Remove Background";
    }
});

// Download original
downloadOriginalBtn.addEventListener("click", function () {
    if (!originalURL) return;

    downloadFile(originalURL, imageName + "-original.png");
});

// Download processed or edited image
downloadProcessedBtn.addEventListener("click", function () {
    const finalImageURL = editedImageURL || processedURL;

    if (!finalImageURL) {
        alert("Please process or edit an image first.");
        return;
    }

    downloadFile(finalImageURL, imageName + "-HA-edited.png");
});

// Remove selected image
removeBtn.addEventListener("click", function () {
    if (originalURL) {
        URL.revokeObjectURL(originalURL);
        originalURL = "";
    }

    clearProcessedImage();

    fileInput.value = "";
    previewImage.src = "";
    preview.style.display = "none";

    imageStatus.textContent = "";
    editStatus.textContent = "";

    removeBgBtn.disabled = false;
    downloadOriginalBtn.disabled = true;
    downloadProcessedBtn.disabled = true;
});

// Download helper
function downloadFile(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();
}

// Clear processed and edited images
function clearProcessedImage() {
    if (processedURL) {
        URL.revokeObjectURL(processedURL);
        processedURL = "";
    }

    if (editedImageURL) {
        URL.revokeObjectURL(editedImageURL);
        editedImageURL = "";
    }

    downloadProcessedBtn.disabled = true;
}

// Resize image
resizeBtn.addEventListener("click", function () {
    if (!previewImage.src || !previewImage.complete || !previewImage.naturalWidth) {
        editStatus.textContent = "Please upload an image first.";
        return;
    }

    const width = Number(imageWidth.value);
    const height = Number(imageHeight.value);

    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        width <= 0 || height <= 0 || width > 10000 || height > 10000) {
        editStatus.textContent = "Enter valid dimensions (1–10000 pixels).";
        return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(previewImage, 0, 0, width, height);

    saveEditedImage(canvas);
});

// Crop center to square
cropBtn.addEventListener("click", function () {
    if (!previewImage.src || !previewImage.complete || !previewImage.naturalWidth) {
        editStatus.textContent = "Please upload an image first.";
        return;
    }

    const width = previewImage.naturalWidth;
    const height = previewImage.naturalHeight;

    const size = Math.min(width, height);
    const x = (width - size) / 2;
    const y = (height - size) / 2;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = size;
    canvas.height = size;

    ctx.drawImage(
        previewImage,
        x, y, size, size,
        0, 0, size, size
    );

    saveEditedImage(canvas);
});

// Save edited image
function saveEditedImage(canvas) {
    canvas.toBlob(function (blob) {
        if (!blob) {
            editStatus.textContent = "Image editing failed.";
            return;
        }

        if (editedImageURL) {
            URL.revokeObjectURL(editedImageURL);
        }

        editedImageURL = URL.createObjectURL(blob);
        previewImage.src = editedImageURL;

        downloadProcessedBtn.disabled = false;
        editStatus.textContent = "Image edited successfully! You can download it now.";

    }, "image/png");
}
