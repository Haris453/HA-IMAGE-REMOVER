
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import crypto from "node:crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_URL = "https://api.remove.bg/v1.0/removebg";

app.use(cors());
app.use(express.json());

// Image upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 22 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG and WEBP images are allowed"));
        }
    }
});

// Temporary storage for processed images
const processedImages = new Map();

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "HA Image Remover Backend is running"
    });
});

// Remove image background
app.post(
    "/api/upload",
    upload.single("image"),
    async (req, res) => {
        try {
            const apiKey = process.env.REMOVE_BG_API_KEY;

            if (!apiKey) {
                return res.status(500).json({
                    success: false,
                    error: "REMOVE_BG_API_KEY is missing in .env"
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "Please select an image first"
                });
            }

            const formData = new FormData();

            const imageBlob = new Blob(
                [req.file.buffer],
                { type: req.file.mimetype }
            );

            formData.append(
                "image_file",
                imageBlob,
                req.file.originalname
            );

            formData.append("size", "auto");
            formData.append("format", "auto");

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "X-Api-Key": apiKey
                },
                body: formData
            });

            if (!response.ok) {
                const errorDetails = await response.text();

                console.error(
                    "remove.bg API error:",
                    response.status,
                    errorDetails
                );

                return res.status(response.status).json({
                    success: false,
                    error: "Background removal failed",
                    details: errorDetails
                });
            }

            const contentType =
                response.headers.get("content-type") || "";

            if (!contentType.startsWith("image/")) {
                return res.status(502).json({
                    success: false,
                    error: "The API did not return an image"
                });
            }

            const imageBuffer = Buffer.from(
                await response.arrayBuffer()
            );

            const jobId = crypto.randomUUID();

            processedImages.set(jobId, {
                buffer: imageBuffer,
                contentType
            });

            res.json({
                success: true,
                message: "Background removed successfully",
                jobId,
                status: "completed",
                downloadReady: true
            });

        } catch (error) {
            console.error("Upload error:", error.message);

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

// Check processing status
app.get("/api/jobs/:jobId", (req, res) => {
    const job = processedImages.get(req.params.jobId);

    if (!job) {
        return res.status(404).json({
            success: false,
            error: "Processed image not found"
        });
    }

    res.json({
        success: true,
        status: "completed",
        downloadReady: true
    });
});

// Download processed image
app.get("/api/jobs/:jobId/download", (req, res) => {
    const job = processedImages.get(req.params.jobId);

    if (!job) {
        return res.status(404).json({
            success: false,
            error: "Processed image not found"
        });
    }

    res.setHeader("Content-Type", job.contentType);

    res.setHeader(
        "Content-Disposition",
        'attachment; filename="HA-Background-Removed.png"'
    );

    res.send(job.buffer);
});

// Error handling
app.use((error, req, res, next) => {
    res.status(400).json({
        success: false,
        error: error.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(
        `HA Image Remover Backend running at http://localhost:${PORT}`
    );
});
