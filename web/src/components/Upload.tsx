import React, { useCallback, useState } from 'react';
import { Badge } from './ui/badge';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from './ui/shadcn-io/dropzone';
import { FileText, CheckCircle, Upload as UploadIcon } from 'lucide-react';
import type { FileRejection } from 'react-dropzone';

export default function Upload({ onUpload }: { onUpload: (f: File) => void }) {
    const [isUploading, setIsUploading] = useState(false);
    const [hasUploaded, setHasUploaded] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    const handleDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
        if (fileRejections.length > 0) {
            console.error('File rejected:', fileRejections[0].errors);
            return;
        }

        const file = acceptedFiles[0];
        if (!file) return;

        setIsUploading(true);
        setUploadedFile(file);
        setHasUploaded(false);
        
        // Add a small delay to show the uploading state
        setTimeout(() => {
            onUpload(file);
            setIsUploading(false);
            setHasUploaded(true);
        }, 500);
    }, [onUpload]);

    return (
        <div className="w-full">
            <Dropzone
                onDrop={handleDrop}
                accept={{
                    'application/json': ['.har'],
                    'application/x-har': ['.har']
                }}
                maxFiles={1}
                maxSize={50 * 1024 * 1024} // 50MB
                src={hasUploaded && uploadedFile ? [uploadedFile] : undefined}
                className="min-h-[200px] transition-all duration-200 ease-in-out hover:border-primary/50 hover:bg-primary/5"
            >
                {!isUploading && !hasUploaded && (
                    <DropzoneEmptyState>
                        <div className="flex flex-col items-center space-y-4 p-4">
                            <div className="p-4 rounded-full bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                                <UploadIcon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                            </div>
                            
                            <div className="space-y-2 text-center">
                                <h3 className="text-lg font-semibold">Upload HAR File</h3>
                                <p className="text-muted-foreground">
                                    Drag & drop a <Badge variant="secondary" className="mx-1">
                                        <FileText className="h-3 w-3 mr-1" />.har
                                    </Badge> file here
                                </p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-muted-foreground">or click to browse</span>
                            </div>
                        </div>
                    </DropzoneEmptyState>
                )}
                
                {(isUploading || hasUploaded) && (
                    <DropzoneContent>
                        {isUploading ? (
                            <div className="flex flex-col items-center space-y-4 p-4">
                                <div className="p-4 rounded-full bg-primary/10 animate-pulse">
                                    <UploadIcon className="h-8 w-8 text-primary animate-bounce" />
                                </div>
                                <div className="space-y-2 text-center">
                                    <h3 className="text-lg font-semibold">Processing...</h3>
                                    <p className="text-muted-foreground">
                                        Uploading {uploadedFile?.name}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center space-y-4 p-4">
                                <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/20">
                                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="space-y-2 text-center">
                                    <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
                                        File Uploaded Successfully!
                                    </h3>
                                    <p className="text-muted-foreground">
                                        {uploadedFile?.name}
                                    </p>
                                </div>
                            </div>
                        )}
                    </DropzoneContent>
                )}
            </Dropzone>
        </div>
    );
}

