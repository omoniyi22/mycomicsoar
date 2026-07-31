import React, { useState, useRef, ChangeEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { queryOptions } from '@tanstack/react-query';
import { getHomeData } from '@/lib/catalog.functions';

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeData(),
});

// ============================================
// TYPES & INTERFACES
// ============================================

interface Size {
  name: string;
  width: number;
  height: number;
  ratio: string;
}

interface ResizedImage extends Size {
  dataUrl: string;
  fileSize: number;
  originalFileName: string;
}

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  image: HTMLImageElement | null;
  loaded: boolean;
  results: ResizedImage[];
}

// ============================================
// COMPONENT
// ============================================

const ImageResizer: React.FC = () => {
  // ============================================
  // STATE
  // ============================================
  
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [currentProcessingImage, setCurrentProcessingImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // CONSTANTS
  // ============================================

  const sizes: Size[] = [
    { name: 'Instagram Feed (Portrait)\Original', width: 1080, height: 1350, ratio: '4:5' },
    { name: 'Instagram Story/Reel', width: 1080, height: 1920, ratio: '9:16' },
    { name: 'Instagram Square Post', width: 1080, height: 1080, ratio: '1:1' },
  ];

  // ============================================
  // IMAGE UPLOAD HANDLERS
  // ============================================

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newImages: ImageFile[] = [];

    fileArray.forEach((file) => {
      const id = `img-${Date.now()}-${Math.random()}`;
      const reader = new FileReader();
      
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const img = new Image();
        img.onload = () => {
          setImages(prev => prev.map(item => {
            if (item.id === id) {
              return {
                ...item,
                image: img,
                loaded: true,
                preview: event.target?.result as string,
              };
            }
            return item;
          }));
        };
        img.src = event.target?.result as string;
      };

      newImages.push({
        id,
        file,
        preview: '',
        image: null,
        loaded: false,
        results: [],
      });
      
      reader.readAsDataURL(file);
    });

    setImages(prev => [...prev, ...newImages]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ============================================
  // IMAGE PROCESSING
  // ============================================

  const resizeImage = (img: HTMLImageElement, targetWidth: number, targetHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve('');
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const imgAspectRatio = img.width / img.height;
      const targetAspectRatio = targetWidth / targetHeight;

      let drawWidth: number;
      let drawHeight: number;
      let offsetX: number;
      let offsetY: number;

      if (imgAspectRatio > targetAspectRatio) {
        drawWidth = targetWidth;
        drawHeight = targetWidth / imgAspectRatio;
        offsetX = 0;
        offsetY = (targetHeight - drawHeight) / 2;
      } else {
        drawHeight = targetHeight;
        drawWidth = targetHeight * imgAspectRatio;
        offsetX = (targetWidth - drawWidth) / 2;
        offsetY = 0;
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve(dataUrl);
    });
  };

  const handleResize = async (): Promise<void> => {
    const loadedImages = images.filter(img => img.loaded && img.image);
    if (loadedImages.length === 0) {
      alert('Please wait for images to load completely');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    const totalImages = loadedImages.length;
    const totalSizes = sizes.length;
    let processedCount = 0;

    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      if (!imageData.loaded || !imageData.image) continue;

      setCurrentProcessingImage(imageData.file.name);

      const results: ResizedImage[] = [];

      for (const size of sizes) {
        const resizedDataUrl = await resizeImage(imageData.image, size.width, size.height);
        
        const base64Length = resizedDataUrl.length - 'data:image/jpeg;base64,'.length;
        const sizeInKB = Math.round((base64Length * 3/4) / 1024);

        results.push({
          ...size,
          dataUrl: resizedDataUrl,
          fileSize: sizeInKB,
          originalFileName: imageData.file.name.replace(/\.[^/.]+$/, ''),
        });

        processedCount++;
        setProcessingProgress(Math.round((processedCount / (totalImages * totalSizes)) * 100));
      }

      setImages(prev => prev.map((item, idx) => {
        if (idx === i) {
          return {
            ...item,
            results: results,
          };
        }
        return item;
      }));
    }

    setIsProcessing(false);
    setProcessingProgress(100);
    setCurrentProcessingImage('');
  };

  // ============================================
  // DOWNLOAD HANDLERS
  // ============================================

  const downloadImage = (dataUrl: string, filename: string): void => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = (): void => {
    const allImages = images.flatMap(img => img.results);
    if (allImages.length === 0) {
      alert('No processed images to download');
      return;
    }
    
    allImages.forEach((img, index) => {
      setTimeout(() => {
        const filename = `${img.originalFileName}_${img.name.replace(/\s/g, '_')}.jpg`;
        downloadImage(img.dataUrl, filename);
      }, index * 500);
    });
  };

  const downloadImageSet = (imageIndex: number): void => {
    const imageData = images[imageIndex];
    if (imageData.results.length === 0) {
      alert('This image has not been processed yet');
      return;
    }
    
    imageData.results.forEach((img, index) => {
      setTimeout(() => {
        const filename = `${img.originalFileName}_${img.name.replace(/\s/g, '_')}.jpg`;
        downloadImage(img.dataUrl, filename);
      }, index * 300);
    });
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const removeImage = (index: number): void => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = (): void => {
    if (images.length === 0) return;
    if (window.confirm('Remove all images?')) {
      setImages([]);
      setProcessingProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const totalImagesProcessed = images.reduce((acc, img) => acc + img.results.length, 0);
  const loadedImagesCount = images.filter(img => img.loaded).length;
  const hasResults = images.some(img => img.results.length > 0);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4 md:p-6 font-sans">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <header className="text-center mb-8">
          <h1 className="text-white text-3xl md:text-4xl font-bold m-0 drop-shadow-md">
            📸 Instagram Image Resizer
          </h1>
          <p className="text-white/90 text-base md:text-lg mt-1">
            Resize multiple images for Instagram with optimal quality and compression
          </p>
        </header>

        {/* UPLOAD SECTION */}
        <section className="bg-white rounded-2xl p-4 md:p-8 max-w-[800px] mx-auto shadow-2xl">
          <div 
            className="border-3 border-dashed border-gray-300 rounded-xl p-8 md:p-10 text-center cursor-pointer transition-all duration-300 hover:border-[#667eea] hover:bg-[#f8f9ff] min-h-[200px] md:min-h-[300px] flex flex-col items-center justify-center relative"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-6xl mb-4">📤</div>
            <p className="my-2 text-lg text-gray-800">Click or drag to upload multiple images</p>
            <small className="text-gray-600">Supports JPG, PNG, WebP (Select multiple files)</small>
            {images.length > 0 && (
              <div className="mt-3">
                <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {loadedImagesCount} / {images.length} images loaded
                </span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          
          <div className="flex flex-col md:flex-row gap-4 justify-center mt-5">
            {images.length > 0 && (
              <>
                <button 
                  onClick={clearAll} 
                  className="px-8 py-3 bg-gray-200 text-gray-800 rounded-full font-semibold cursor-pointer transition-all duration-300 hover:bg-gray-300 hover:-translate-y-0.5 w-full md:w-auto"
                >
                  🗑️ Clear All ({images.length})
                </button>
                <button 
                  onClick={handleResize} 
                  className="px-8 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-full font-semibold cursor-pointer transition-all duration-300 shadow-lg shadow-[#667eea]/40 hover:-translate-y-0.5 hover:shadow-[#667eea]/60 disabled:opacity-60 disabled:cursor-not-allowed w-full md:w-auto"
                  disabled={isProcessing || loadedImagesCount === 0}
                >
                  {isProcessing 
                    ? `⏳ Processing... ${processingProgress}%` 
                    : `🔄 Resize & Compress (${loadedImagesCount})`
                  }
                </button>
              </>
            )}
          </div>

          {/* PROGRESS BAR */}
          {isProcessing && (
            <div className="mt-5">
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden relative">
                <div 
                  className="h-full bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-full transition-all duration-300 flex items-center justify-center"
                  style={{ width: `${processingProgress}%` }}
                >
                  <span className="text-white text-xs font-bold drop-shadow">
                    {processingProgress}%
                  </span>
                </div>
              </div>
              {currentProcessingImage && (
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Processing: {currentProcessingImage}
                </p>
              )}
            </div>
          )}
        </section>

        {/* RESULTS SECTION */}
        {images.length > 0 && !isProcessing && (
          <section className="bg-white rounded-2xl p-4 md:p-8 mt-8 shadow-2xl">
            <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
              <h2 className="text-2xl font-bold text-gray-800 m-0">
                ✨ Resized Images ({totalImagesProcessed} total)
              </h2>
              <button 
                onClick={downloadAll} 
                className="px-8 py-3 bg-gradient-to-r from-[#11998e] to-[#38ef7d] text-white rounded-full font-semibold cursor-pointer transition-all duration-300 shadow-lg shadow-[#38ef7d]/40 hover:-translate-y-0.5 hover:shadow-[#38ef7d]/60 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!hasResults}
              >
                ⬇️ Download All
              </button>
            </div>
            
            {/* IMAGE GROUPS */}
            <div className="space-y-8">
              {images.map((imageData, imageIndex) => (
                <div key={imageData.id} className="bg-gray-50 rounded-xl p-4 md:p-6 shadow">
                  {/* Image Group Header */}
                  <div className="mb-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-gray-800 m-0">
                        📄 {imageData.file.name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => downloadImageSet(imageIndex)} 
                          className="px-4 py-2 bg-[#667eea] text-white rounded-lg font-medium text-sm cursor-pointer transition-all duration-300 hover:bg-[#5a67d8] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                          disabled={imageData.results.length === 0}
                        >
                          ⬇️ Download Set
                        </button>
                        <button 
                          onClick={() => removeImage(imageIndex)} 
                          className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium text-sm cursor-pointer transition-all duration-300 hover:bg-red-600 hover:-translate-y-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {imageData.loaded && imageData.image && (
                      <p className="text-sm text-gray-600 mt-1">
                        Original: {imageData.image.width} × {imageData.image.height}px
                      </p>
                    )}
                    {!imageData.loaded && (
                      <p className="text-sm text-gray-500 mt-1">⏳ Loading image...</p>
                    )}
                    {imageData.results.length > 0 && (
                      <p className="text-sm text-green-600 font-semibold mt-1">
                        ✅ Processed ({imageData.results.length} sizes)
                      </p>
                    )}
                  </div>
                  
                  {/* Image Results Grid */}
                  {imageData.results.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {imageData.results.map((img, resultIndex) => (
                        <div key={resultIndex} className="bg-white rounded-xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                          <div className="relative bg-gray-200 aspect-square flex items-center justify-center p-2">
                            <img 
                              src={img.dataUrl} 
                              alt={img.name} 
                              className="max-w-full max-h-full object-contain"
                            />
                            <div className="absolute top-2 right-2 flex flex-col gap-1">
                              <span className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
                                {img.width}×{img.height}
                              </span>
                              <span className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
                                {img.ratio}
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            <h4 className="text-sm font-semibold text-gray-800 m-0 mb-2">{img.name}</h4>
                            <p className="text-sm text-gray-600 m-0">📐 {img.width} × {img.height}px</p>
                            <p className="text-sm text-gray-600 m-0">💾 {img.fileSize} KB</p>
                            <button 
                              onClick={() => downloadImage(
                                img.dataUrl, 
                                `${img.originalFileName}_${img.name.replace(/\s/g, '_')}.jpg`
                              )}
                              className="w-full mt-3 px-4 py-2 bg-[#667eea] text-white rounded-lg font-medium text-sm cursor-pointer transition-all duration-300 hover:bg-[#5a67d8] hover:-translate-y-0.5"
                            >
                              ⬇️ Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    imageData.loaded && (
                      <div className="text-center py-8 text-gray-500">
                        <span>⏳ Not processed yet</span>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>

            {/* INFO SECTION */}
            <div className="mt-8 p-5 bg-[#f8f9ff] rounded-xl border-l-4 border-[#667eea]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-start gap-2">
                  <span className="text-xl">💡</span>
                  <p className="text-sm text-gray-600 m-0">Compressed with JPEG quality 92% for optimal size/quality balance</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xl">📐</span>
                  <p className="text-sm text-gray-600 m-0">Maintains original aspect ratio with white padding (no cropping)</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xl">📱</span>
                  <p className="text-sm text-gray-600 m-0">Perfect for Instagram posts while preserving full image content</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xl">🔄</span>
                  <p className="text-sm text-gray-600 m-0">Supports batch processing of multiple images simultaneously</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* EMPTY STATE */}
        {images.length === 0 && !isProcessing && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 mt-8 text-center">
            <div className="max-w-md mx-auto">
              <span className="text-6xl block mb-4">🖼️</span>
              <h3 className="text-2xl font-bold text-white m-0">No images uploaded yet</h3>
              <p className="text-white/80 mt-2">Upload images to resize them for Instagram</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// ROUTE CONFIGURATION
// ============================================

export const Route = createFileRoute('/resizer')({
  head: () => ({
    meta: [
      { title: 'Comicsoar — A Curated Comics Emporium' },
      {
        name: 'description',
        content:
          'Discover new releases, collectible hardcovers, manga, and creator-owned indies on Comicsoar. Subscribe to your favorite series and build your collection.',
      },
      { property: 'og:title', content: 'Comicsoar — A Curated Comics Emporium' },
      {
        property: 'og:description',
        content:
          'New issues every Wednesday. Hardcovers worth the shelf space. Subscriptions, pull lists, and graded collectibles.',
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: ImageResizer,
});