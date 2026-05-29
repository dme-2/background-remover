# Background Remover - Bulk Image Processing Web App

A powerful web application for removing backgrounds from multiple images at once. Process images in bulk with an intuitive interface and download results instantly.

## Features

- ✅ Bulk image upload (drag & drop)
- ✅ Automatic background removal
- ✅ Batch processing with progress tracking
- ✅ Before/after preview
- ✅ Batch download (ZIP)
- ✅ Processing history
- ✅ User authentication
- ✅ Responsive design

## Tech Stack

### Frontend
- React 18
- Tailwind CSS
- Axios
- React Query
- Zustand (State Management)

### Backend
- Node.js + Express
- Python FastAPI (for image processing)
- PostgreSQL
- Docker
- AWS S3 (for image storage)

## Quick Start

### Prerequisites
- Node.js v16+
- Python 3.8+
- Docker
- PostgreSQL

### Installation

1. Clone the repository
```bash
git clone https://github.com/dme-2/background-remover.git
cd background-remover
```

2. Install dependencies
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install

# Image Processor
cd ../image-processor
pip install -r requirements.txt
```

3. Run with Docker
```bash
docker-compose up -d
```

Visit `http://localhost:3000`
