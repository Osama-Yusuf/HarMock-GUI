import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Download, TestTube, Terminal } from 'lucide-react';

export default function SuitePanel({ onCreate, selectedCount }: { onCreate: (name: string) => void; selectedCount: number }) {
    const [name, setName] = useState('regression-suite');
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-5 w-5" />
                    Create Test Suite
                </CardTitle>
                <CardDescription>
                    Generate a test suite from selected entries
                </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Suite Name</label>
                    <Input 
                        value={name} 
                        onChange={e => setName(e.target.value)}
                        placeholder="Enter suite name"
                    />
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Selected entries:</span>
                        <Badge variant={selectedCount > 0 ? "default" : "secondary"}>
                            {selectedCount}
                        </Badge>
                    </div>
                </div>
                
                <Button 
                    className="w-full" 
                    disabled={!selectedCount} 
                    onClick={() => onCreate(name)}
                >
                    <Download className="h-4 w-4 mr-2" />
                    Download suite.json ({selectedCount} items)
                </Button>
                
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Terminal className="h-4 w-4" />
                        Usage Instructions
                    </div>
                    <code className="text-xs bg-background px-2 py-1 rounded block">
                        npm run suite -- --target http://localhost:3000 --suite ./suite.json
                    </code>
                </div>
            </CardContent>
        </Card>
    );
}

