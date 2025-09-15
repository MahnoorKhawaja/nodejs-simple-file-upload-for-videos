const express = require('express');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View engine setup (EJS templates in /views)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Multer (memory storage for direct upload to Azure)
const upload = multer({ storage: multer.memoryStorage() });

// Azure Blob setup (single container for videos)
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(process.env.VIDEO_CONTAINER_NAME);

// ✅ Upload Video
app.post(['/upload', '/videos/upload'], upload.single('file'), async(req, res) => {
    if (!req.file) {
        return res.status(400).send('⚠️ No file uploaded');
    }

    try {
        const blobName = `${Date.now()}-${req.file.originalname}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.uploadData(req.file.buffer, {
            blobHTTPHeaders: { blobContentType: req.file.mimetype }
        });

        console.log(`✅ Uploaded "${req.file.originalname}" to Azure Blob`);

        // Redirect to /videos to show the updated list
        res.redirect('/videos');
    } catch (err) {
        console.error('❌ Upload error:', err.message);
        res.status(500).send('❌ Upload to Azure Blob failed');
    }
});

// ✅ Default route → redirect to /videos page
app.get('/', (req, res) => {
    res.redirect('/videos');
});

// ✅ Videos page (upload form + list all videos)
app.get('/videos', async(req, res) => {
    try {
        let videoUrls = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            videoUrls.push(containerClient.getBlockBlobClient(blob.name).url);
        }

        res.render('index', { videos: videoUrls });
    } catch (err) {
        console.error('❌ Error listing videos:', err.message);
        res.status(500).send('❌ Failed to fetch videos');
    }
});

// ✅ Health check (for probes, App Gateway, etc.)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});