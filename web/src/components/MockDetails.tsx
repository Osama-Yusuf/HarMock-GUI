import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Copy, Server, Settings, BarChart3 } from 'lucide-react';

export default function MockDetails({ mock, onToggleMode, onToggleDelay, onToggleBodyMode }: any) {
    const root = `${location.origin}/m/${mock.id}`;
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <Server className="h-5 w-5" />
                            Mock Server Details
                        </CardTitle>
                        <CardDescription>
                            Mock ID: <Badge variant="outline">{mock.id}</Badge>
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                            {mock.counts.entries} entries • {mock.counts.endpoints} endpoints
                        </span>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
                {/* Mock Root URL */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Mock Root URL</label>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                            {root}
                        </code>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => copyToClipboard(root)}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Mode
                        </label>
                        <select 
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                            value={mock.mode} 
                            onChange={e => onToggleMode(e.target.value as any)}
                        >
                            <option value="endpoint">Endpoint</option>
                            <option value="sequence">Sequence</option>
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Simulate Delay</label>
                        <div className="flex items-center space-x-2">
                            <Switch 
                                checked={mock.simulateDelay} 
                                onCheckedChange={onToggleDelay}
                            />
                            <span className="text-sm text-muted-foreground">
                                {mock.simulateDelay ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Body Mode</label>
                        <select 
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                            value={mock.bodyMode || 'scrubbed'} 
                            onChange={e => onToggleBodyMode(e.target.value as any)}
                        >
                            <option value="scrubbed">Scrubbed</option>
                            <option value="original">Original</option>
                        </select>
                    </div>
                </div>

                {/* Endpoints Table */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Endpoints Overview</label>
                    <div className="overflow-auto border rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr className="border-b">
                                    <th className="text-left py-2 px-3 font-medium">Method</th>
                                    <th className="text-left py-2 px-3 font-medium">Path</th>
                                    <th className="text-left py-2 px-3 font-medium">Count</th>
                                    <th className="text-left py-2 px-3 font-medium">Status (min/avg/max)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mock.endpoints.map((e: any) => (
                                    <tr key={`${e.method}-${e.path}`} className="border-b last:border-b-0 hover:bg-muted/30">
                                        <td className="py-2 px-3">
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {e.method}
                                            </Badge>
                                        </td>
                                        <td className="py-2 px-3">
                                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                                {e.path}
                                            </code>
                                        </td>
                                        <td className="py-2 px-3">{e.count}</td>
                                        <td className="py-2 px-3 font-mono text-xs">
                                            {e.minStatus}/{e.avgStatus}/{e.maxStatus}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Example curl commands will appear when you select individual entries below.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

