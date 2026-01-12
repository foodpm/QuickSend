import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  File,
  Download,
  Trash2,
  Lock,
  Unlock,
  Copy,
  Share2,
  Wifi,
  CheckCircle,
  Shield,
  Zap,
  HelpCircle,
  ExternalLink,
  Smartphone,
  HardDrive,
  Settings,
  FolderOpen,
  X,
  LogOut,
  User,
  QrCode,
  Play,
  Eye,
  Music,
  FileText,
  Code,
  Archive,
  FileSpreadsheet,
  FileType,
  Search,
  LogIn,
  ChevronRight,
  ChevronDown,
  Plus,
  Folder,
  EyeOff,
  AlertCircle,
  Info,
  Pencil,
  Pin,
  PinOff
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { FileItem, IpResponse, TextItem, GroupItem } from '../../types';
import { useTranslation } from 'react-i18next';
import { initTCB, recordInstall, recordDailyActive, recordFileStats } from '../utils/tcb';
import { Globe } from 'lucide-react';

// --- Utility Functions ---

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // If less than 24 hours
  if (diff < 24 * 60 * 60 * 1000 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const safeCopyText = async (text: string): Promise<boolean> => {
  try {
    if ((navigator as any).clipboard && typeof (navigator as any).clipboard.writeText === 'function') {
      await (navigator as any).clipboard.writeText(text);
      return true;
    }
  } catch { }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch { }
  try {
    window.prompt('复制到剪贴板失败，请手动复制：', text);
  } catch { }
  return false;
};

// --- Tree Helpers ---

interface GroupTreeItem extends GroupItem {
  childrenNodes: GroupTreeItem[];
  depth: number;
}

const buildGroupTree = (groups: GroupItem[]): GroupTreeItem[] => {
  const map = new Map<string, GroupTreeItem>();
  
  // Initialize map
  groups.forEach(g => {
    map.set(g.id, { ...g, childrenNodes: [], depth: 0 });
  });
  
  // Ensure root exists
  if (!map.has('root')) {
    map.set('root', { id: 'root', name: 'root', childrenNodes: [], depth: 0 });
  }
  
  // Build tree
  groups.forEach(g => {
    if (g.id === 'root') return; 
    const node = map.get(g.id)!;
    const parentId = g.parent_id || 'root';
    if (map.has(parentId)) {
        map.get(parentId)!.childrenNodes.push(node);
    } else {
        map.get('root')!.childrenNodes.push(node);
    }
  });

  // Sort children (pinned first)
  map.forEach(node => {
    node.childrenNodes.sort((a, b) => {
       if (a.is_pinned && !b.is_pinned) return -1;
       if (!a.is_pinned && b.is_pinned) return 1;
       return 0;
    });
  });

  // Calculate depth
  const setDepth = (node: GroupTreeItem, d: number) => {
    node.depth = d;
    node.childrenNodes.forEach(c => setDepth(c, d + 1));
  };
  
  const rootNode = map.get('root')!;
  setDepth(rootNode, 0);
  
  return [rootNode];
};

const flattenTree = (nodes: GroupTreeItem[]): GroupTreeItem[] => {
    let result: GroupTreeItem[] = [];
    nodes.forEach(node => {
        result.push(node);
        if (node.childrenNodes.length > 0) {
            result = result.concat(flattenTree(node.childrenNodes));
        }
    });
    return result;
};

const Toast = ({ message, type = 'info', onClose }: { message: string, type?: 'info' | 'error' | 'success', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!message) return null;

  return createPortal(
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[10000] animate-fade-in-down">
      <div className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
        type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' :
        type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' :
        'bg-slate-800 text-white'
      }`}>
        {type === 'error' ? <AlertCircle size={16} /> :
         type === 'success' ? <CheckCircle size={16} /> :
         <Info size={16} />}
        <span>{message}</span>
      </div>
    </div>,
    document.body
  );
};

const GroupNode = ({
  node,
  files,
  expandedState,
  onToggle,
  isHost,
  dragOverId,
  onDragOver,
  onDragLeave,
  onDrop,
  onHide,
  onDeleteGroup,
  onEditGroup,
  onPinGroup,
  fileCardProps
}: any) => {
  const isRoot = node.id === 'root';
  const isExpanded = expandedState[node.id];
  const groupFiles = files.filter((f: FileItem) => (f.group_id || 'root') === node.id);
  // Always hide header for root, effectively making it "default expanded" and invisible container
  const hideHeader = isRoot;

  return (
    <div 
      className={`rounded-lg ${hideHeader ? '' : 'border border-slate-100 bg-white mb-2'} transition-all overflow-hidden`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(node.id); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(node.id, e)}
    >
       {!hideHeader && (
          <div 
            className="group/header flex items-center justify-between px-3 py-2 select-none hover:bg-slate-50/50 transition-colors"
            style={{ paddingLeft: `${node.depth * 16 + 12}px` }}
          >
             <div className="flex items-center gap-2 overflow-hidden">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                >
                   {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                
                <div className="flex items-center gap-1.5 min-w-0">
                   <Folder size={16} className={`shrink-0 ${dragOverId === node.id ? 'text-indigo-500 fill-indigo-50' : 'text-indigo-400'}`} />
                   <span className={`text-sm font-medium truncate ${dragOverId === node.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                     {node.name || '分组'}
                   </span>
                   {node.is_pinned && <Pin size={12} className="text-amber-500 rotate-45" fill="currentColor" />}
                </div>

                {isHost && !isRoot && (
                   <div className="flex items-center gap-1 ml-2 opacity-0 group-hover/header:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onEditGroup(node); }}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="编辑"
                      >
                         <Pencil size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onPinGroup(node.id, !node.is_pinned); }}
                        className={`p-1 rounded hover:bg-slate-100 ${node.is_pinned ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'}`}
                        title={node.is_pinned ? "取消置顶" : "置顶"}
                      >
                         {node.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onHide(node.id, !node.hidden); }}
                        className={`p-1 rounded hover:bg-slate-100 ${node.hidden ? 'text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
                        title={node.hidden ? "显示" : "隐藏"}
                      >
                         {node.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteGroup(node.id); }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除"
                      >
                         <Trash2 size={14} />
                      </button>
                   </div>
                )}
             </div>
          </div>
       )}
       
       {(isExpanded || hideHeader) && (
          <div className="flex flex-col gap-2 pb-1">
             {node.childrenNodes.map((child: GroupTreeItem) => (
                <GroupNode 
                   key={child.id} 
                   node={child} 
                   files={files} 
                   expandedState={expandedState}
                   onToggle={onToggle}
                   isHost={isHost}
                   dragOverId={dragOverId}
                   onDragOver={onDragOver}
                   onDragLeave={onDragLeave}
                   onDrop={onDrop}
                   onHide={onHide}
                   onDeleteGroup={onDeleteGroup}
                   onEditGroup={onEditGroup}
                   onPinGroup={onPinGroup}
                   fileCardProps={fileCardProps}
                />
             ))}

             {groupFiles.map((file: FileItem) => (
                <div key={file.name} style={{ paddingLeft: hideHeader ? 0 : `${(node.depth + 1) * 20}px`, paddingRight: hideHeader ? 0 : '12px' }}>
                   <FileCard file={file} {...fileCardProps} />
                </div>
             ))}
          </div>
       )}
    </div>
  );
};

const GroupTree = ({ nodes, ...props }: any) => {
  return (
    <div className="flex flex-col gap-2">
      {nodes.map((node: GroupTreeItem) => (
        <GroupNode key={node.id} node={node} {...props} />
      ))}
    </div>
  );
};

// --- Components ---

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
  <div className="flex items-center gap-2 mb-3 px-1">
    <Icon size={14} className="text-slate-500" />
    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
  </div>
);

const AuthModal = ({
  isOpen,
  onClose,
  onLoginSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string, username: string) => void;
}) => {
  const [username, setUsername] = useState(localStorage.getItem('last_username') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      // If username is empty, try to load from storage again
      if (!username) setUsername(localStorage.getItem('last_username') || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        onLoginSuccess(data.token, data.username);
        onClose();
        setPassword(''); // Clear password on success
      } else {
        setError(data.message || '验证失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900">登录 / 注册</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">本机名称</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="输入名称"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">访问密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="设置或验证密码"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? '处理中...' : '登录 / 注册'}
          </button>
        </form>
      </div>
    </div>
  );
};

const QrCodeModal = ({
  isOpen,
  onClose,
  url
}: {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
}) => {
  if (!isOpen || !url) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X size={24} />
        </button>
        
        <h3 className="text-xl font-bold text-slate-900 mb-6">扫码连接</h3>
        
        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-inner mb-6">
          <QRCodeCanvas
            id="qr-code-canvas"
            value={url}
            size={240}
            level={"H"}
            includeMargin={true}
          />
        </div>
        
        <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <p className="text-sm font-mono text-slate-600 break-all select-all">
            {url}
          </p>
        </div>
        
        <p className="text-slate-400 mt-4 text-xs text-center">
          请使用手机相机或扫码应用扫描上方二维码
        </p>
      </div>
      
      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>,
    document.body
  );
};

const UserProfileCard = ({
  ipAddress,
  username,
  isLoggedIn,
  onLogin,
  onLogout,
  isHost,
  onOpenSettings
}: {
  ipAddress: string | null,
  username: string,
  isLoggedIn: boolean,
  onLogin: () => void,
  onLogout: () => void,
  isHost?: boolean,
  onOpenSettings?: () => void
}) => {
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  const handleCopy = () => {
    if (ipAddress) {
      safeCopyText(ipAddress).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <QrCodeModal
        isOpen={showQrCode}
        onClose={() => setShowQrCode(false)}
        url={ipAddress}
      />
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Zap size={16} fill="currentColor" className="text-yellow-400" />
          </div>
          <span className="font-bold text-slate-900">QuickSend</span>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              title="设置"
            >
              <Settings size={16} />
            </button>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-medium text-slate-600">Online</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">本机身份</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 group">
              <div className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 flex items-center justify-between">
                <span className={!username ? "text-slate-400" : ""}>{username || '未登录'}</span>
                {isLoggedIn && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-medium">已登录</span>}
              </div>
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
            {isLoggedIn ? (
               <button
                onClick={onLogout}
                className="p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors border border-slate-200 hover:border-red-200"
                title="退出登录"
               >
                 <LogOut size={16} />
               </button>
            ) : (
              <button
                onClick={onLogin}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-sm transition-all whitespace-nowrap"
              >
                登录
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">局域网连接地址</label>
          <div
            onClick={handleCopy}
            className="cursor-pointer flex items-center justify-between p-2.5 bg-slate-900 hover:bg-slate-800 rounded-lg transition-all active:scale-[0.99] group/ip"
          >
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <Wifi size={16} className={copied ? "text-green-400 shrink-0" : "text-slate-400 shrink-0"} />
              <div className="relative overflow-hidden">
                <code className="text-sm font-mono font-medium text-slate-100 whitespace-nowrap truncate group-hover/ip:overflow-visible group-hover/ip:text-clip transition-all duration-300">
                  <span className="group-hover/ip:animate-[marquee_5s_linear_infinite] inline-block">
                    {ipAddress || '获取中...'}
                  </span>
                </code>
              </div>
            </div>
            <div className="shrink-0 ml-2 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQrCode(true);
                }}
                className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-md hover:bg-slate-700"
                title="展示二维码"
              >
                <QrCode size={16} />
              </button>
              {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} className="text-slate-400" />}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            在同一 Wi-Fi 下的设备浏览器中输入此地址即可互传文件。
          </p>
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
};

const UploadCard = ({ onUpload, onShareText = () => { }, isUploading, progress, isLoggedIn, onLoginRequired, groups, selectedGroupId, onChangeGroup }: { onUpload: (files: FileList, password?: string, groupId?: string) => void, onShareText?: (content: string, password?: string) => void, isUploading: boolean, progress: number, isLoggedIn: boolean, onLoginRequired: () => void, groups: GroupItem[], selectedGroupId: string, onChangeGroup: (id: string) => void }) => {
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [isDragOver, setIsDragOver] = useState(false);
  const [password, setPassword] = useState('');
  const [textContent, setTextContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupId, setGroupId] = useState<string>(selectedGroupId || 'root');
  useEffect(() => { setGroupId(selectedGroupId || 'root'); }, [selectedGroupId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (mode === 'file' && !isUploading && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files, password, groupId);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files, password, groupId);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const shareText = () => {
    const content = textContent.trim();
    if (!content) return;
    onShareText(content, password);
    setTextContent('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isLoggedIn) {
          onLoginRequired();
          return;
      }
      setPassword(e.target.value);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1">
      <div className="flex items-center gap-2 px-3 pt-3">
        <button onClick={() => setMode('file')} className={`px-2 py-1 rounded text-xs font-medium ${mode === 'file' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>文件</button>
        <button onClick={() => setMode('text')} className={`px-2 py-1 rounded text-xs font-medium ${mode === 'text' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>文字</button>
      </div>
      <div
        className={`relative flex flex-col items-center justify-center w-full rounded-lg transition-all duration-200 overflow-hidden mt-2 ${isUploading && mode === 'file'
          ? 'bg-slate-50 border border-slate-200 py-8'
          : isDragOver && mode === 'file'
            ? 'bg-blue-50 border-2 border-dashed border-blue-400 py-8'
            : 'bg-slate-50 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-100 py-6'
          }`}
        onDragOver={(e) => { e.preventDefault(); mode === 'file' && !isUploading && setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {mode === 'file' ? (
          isUploading ? (
            <div className="w-full px-6 flex flex-col items-center animate-fade-in">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
                <div className="w-4 h-4 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-2">正在传输...</p>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-900 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono">{Math.round(progress)}%</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center w-full px-4">
              <div className={`w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors ${isDragOver ? 'bg-blue-100 text-blue-600' : 'bg-white border border-slate-200 text-slate-600 shadow-sm'}`}>
                <Upload size={20} strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">点击或拖拽上传</h3>
              <p className="text-xs text-slate-400 mb-5">支持任意文件格式</p>
      <div className="w-full space-y-2">
                <div className="relative">
                  <select
                    value={groupId}
                    onChange={(e) => { setGroupId(e.target.value); onChangeGroup(e.target.value); }}
                    className="w-full pl-3 pr-8 py-2 bg-white rounded-md border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none text-xs text-slate-800 appearance-none"
                  >
                    {flattenTree(buildGroupTree(groups)).map(g => (
                      <option key={g.id} value={g.id}>
                        {'\u00A0'.repeat(g.depth * 2) + (g.id === 'root' ? '根目录' : g.name)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={isLoggedIn ? "设置访问密码 (可选)" : "登录后可设置密码"}
                    value={password}
                    onChange={handlePasswordChange}
                    onClick={() => !isLoggedIn && onLoginRequired()}
                    readOnly={!isLoggedIn}
                    className={`w-full text-center px-3 py-2 bg-white rounded-md border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none text-xs text-slate-800 placeholder-slate-400 transition-all ${!isLoggedIn ? 'cursor-pointer bg-slate-50' : ''}`}
                  />
                  {password && <Shield className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  选择文件
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )
        ) : (
          <div className="flex flex-col w-full px-4 gap-2">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="输入要分享的文字"
              className="w-full h-28 px-3 py-2 bg-white rounded-md border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none text-xs text-slate-800 placeholder-slate-400 transition-all"
            />
            <div className="relative">
              <input
                type="text"
                placeholder={isLoggedIn ? "设置访问密码 (可选)" : "登录后可设置密码"}
                value={password}
                onChange={handlePasswordChange}
                onClick={() => !isLoggedIn && onLoginRequired()}
                readOnly={!isLoggedIn}
                className={`w-full px-3 py-2 bg-white rounded-md border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none text-xs text-slate-800 placeholder-slate-400 transition-all ${!isLoggedIn ? 'cursor-pointer bg-slate-50' : ''}`}
              />
              {password && <Shield className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />}
            </div>
            <button
              onClick={shareText}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-sm transition-all"
            >
              分享文字
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const FileCard = ({
  file,
  currentUser,
  onDelete,
  onSetPassword,
  onPreview,
  onSetGroup,
  onDownload,
  onCopyLink,
  groups,
  isHost,
  isLoggedIn
}: {
  file: FileItem;
  currentUser: string;
  onDelete: (name: string) => void;
  onSetPassword: (name: string, isLocked: boolean) => void;
  onPreview: (file: FileItem, password?: string) => void;
  onSetGroup: (name: string) => void;
  onDownload: (file: FileItem) => void;
  onCopyLink: (file: FileItem) => void;
  groups: GroupItem[];
  isHost?: boolean;
  isLoggedIn: boolean;
}) => {
  const { showToast } = useToast();
  const isOwner = isLoggedIn && file.uploader === currentUser;
  
  const handlePreview = () => {
    // We still need password for preview, but we can let App handle it if we pass just the file
    // But onPreview expects (file, password).
    // If we want to remove prompt from here, we should change onPreview signature or handle it in App.
    // Let's assume onPreview in App will handle the prompt if password is missing but required?
    // No, currently onPreview sets state.
    // Let's change onPreview to take just file, and App handles logic?
    // But GroupNode passes onPreview.
    // Let's keep onPreview as is for now, but we might need to lift the prompt.
    // Actually, for consistency, let's just call onPreview(file) and let App decide if it needs to prompt.
    // But onPreview in App currently just sets state.
    // I'll change onPreview to (file: FileItem) => void in props, and update App to handle the rest.
    onPreview(file);
  };

  const handleOpen = async () => {
    try {
      await fetch('/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.name, reveal: true })
      });
    } catch (e) {
      showToast('打开失败', 'error');
    }
  };
  
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
  const isPdf = ext === 'pdf';
  const isText = ['txt', 'md', 'log', 'js', 'py', 'java', 'xml', 'json', 'css', 'html', 'ts', 'tsx', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'sh', 'bat', 'ini', 'yaml', 'yml', 'sql', 'properties', 'conf'].includes(ext);
  const isZip = ['zip', 'jar'].includes(ext);
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
  const isCsv = ext === 'csv';
  const isBin = ['bin', 'multi', 'dat', 'exe', 'dll', 'so', 'dylib'].includes(ext);
  
  const canPreview = isImage || isVideo || isAudio || isPdf || isText || isZip || isOffice || isCsv || isBin;

  return (
    <div className="group bg-white border border-slate-100 rounded-lg p-3 sm:p-4 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row gap-3 sm:items-center justify-between" draggable onDragStart={(e) => { try { e.dataTransfer.setData('application/json', JSON.stringify({ t: 'file', name: file.name })); e.dataTransfer.effectAllowed = 'move'; } catch {} }}>
        <div className="flex items-start gap-3 min-w-0">
        <div 
          className={`w-10 h-10 rounded bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center shrink-0 ${canPreview ? 'cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors' : ''}`}
          onClick={canPreview ? handlePreview : undefined}
          title={canPreview ? "点击预览" : ""}
        >
          {isImage ? (
            <span className="text-[10px] font-bold uppercase text-slate-400">IMG</span>
          ) : isVideo ? (
            <Play size={18} strokeWidth={1.5} />
          ) : isAudio ? (
            <Music size={18} strokeWidth={1.5} />
          ) : isText ? (
             <FileText size={18} strokeWidth={1.5} />
          ) : isZip ? (
             <Archive size={18} strokeWidth={1.5} />
          ) : isOffice ? (
             <FileSpreadsheet size={18} strokeWidth={1.5} />
          ) : (
            <File size={18} strokeWidth={1.5} />
          )}
        </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-slate-900 truncate pr-2 cursor-pointer hover:text-indigo-600 transition-colors" title={file.name} onClick={canPreview ? handlePreview : undefined}>
                {file.name}
              </h4>
              {file.has_password && (
                <Lock size={12} className="text-amber-500 shrink-0" />
              )}
            </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="font-mono">{formatSize(file.size)}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-slate-300"></span>
            <span>{file.uploader || '访客'}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-slate-300"></span>
            <span>{formatDate(file.mtime)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-50 mt-1 sm:mt-0">
        {canPreview && (
          <button
            onClick={handlePreview}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium transition-colors"
          >
            <Eye size={14} />
            <span className="sm:hidden">预览</span>
          </button>
        )}
        
        {isHost ? (
          <button
            onClick={handleOpen}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-md text-xs font-medium transition-colors"
            title="在文件夹中显示"
          >
            <FolderOpen size={14} />
            <span className="sm:hidden">打开</span>
          </button>
        ) : (
          <button
            onClick={() => onDownload(file)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition-colors"
          >
            <Download size={14} />
            <span className="sm:hidden">下载</span>
          </button>
        )}

      <div className="flex items-center gap-1">
        <button
          onClick={() => onCopyLink(file)}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
          title="复制链接"
        >
          <Copy size={16} />
        </button>

        {isOwner && (
          <>
            <button
              onClick={() => onSetPassword(file.name, !!file.has_password)}
              className={`p-1.5 rounded-md transition-colors ${file.has_password ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
              title="设置密码"
            >
              {file.has_password ? <Shield size={16} /> : <Unlock size={16} />}
            </button>
            <button
              onClick={() => onDelete(file.name)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  </div>
);
};

const TextCard = ({
  item,
  currentUser,
  onDelete,
  onSetPassword,
  onCopy,
  isLoggedIn
}: {
  item: TextItem;
  currentUser: string;
  onDelete: (id: string) => void;
  onSetPassword: (id: string, isLocked: boolean) => void;
  onCopy: (item: TextItem) => void;
  isLoggedIn: boolean;
}) => {
  const isOwner = isLoggedIn && item.uploader === currentUser;
  const display = item.has_password ? '****' : (item.content || '');

  return (
    <div className="group bg-white border border-slate-100 rounded-lg p-3 sm:p-4 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold uppercase text-slate-400">TXT</span>
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-900 truncate pr-2" title={item.has_password ? '已加密' : (item.content || '')}>
              {display}
            </h4>
            {item.has_password && (
              <Lock size={12} className="text-amber-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>{item.uploader || '访客'}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-slate-300"></span>
            <span>{formatDate(item.mtime)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-50 mt-1 sm:mt-0">
        <button
          onClick={() => onCopy(item)}
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition-colors"
        >
          <Copy size={14} />
          <span className="sm:hidden">复制</span>
        </button>
        {isOwner && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSetPassword(item.id, !!item.has_password)}
              className={`p-1.5 rounded-md transition-colors ${item.has_password ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
              title="设置密码"
            >
              {item.has_password ? <Shield size={16} /> : <Unlock size={16} />}
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsModal = ({
  isOpen,
  onClose,
  config,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  config: IpResponse;
  onSave: (newConfig: Partial<IpResponse>) => void;
}) => {
  const [uploadDir, setUploadDir] = useState(config.upload_dir || '');
  const [mode, setMode] = useState(config.mode || 'share');
  const [allowRemoteGroupCreate, setAllowRemoteGroupCreate] = useState<boolean>(config.allow_remote_group_create ?? true);
  const [useSourceDate, setUseSourceDate] = useState<boolean>(config.use_source_date ?? false);

  useEffect(() => {
    setUploadDir(config.upload_dir || '');
    setMode(config.mode || 'share');
    setAllowRemoteGroupCreate(config.allow_remote_group_create ?? true);
    setUseSourceDate(config.use_source_date ?? false);
  }, [config]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ upload_dir: uploadDir, mode, allow_remote_group_create: allowRemoteGroupCreate, use_source_date: useSourceDate });
    onClose();
  };

  const handleSelectFolder = async () => {
    try {
      const res = await fetch('/api/select-folder', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.path) setUploadDir(data.path);
      } else {
        // Ignore cancellation
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900">设置</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {/* Path */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">文件存储位置</label>
            <div className="relative">
              <input
                type="text"
                value={uploadDir}
                onChange={e => setUploadDir(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="/path/to/uploads"
              />
              <button
                onClick={handleSelectFolder}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="选择文件夹"
              >
                <FolderOpen size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 ml-1">仅本机可修改，修改后新文件将保存至此目录。</p>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">传输模式</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('share')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${mode === 'share'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
              >
                <HardDrive size={18} />
                共享中心
              </button>
              <button
                onClick={() => setMode('oneway')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${mode === 'oneway'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
              >
                <Upload size={18} />
                单向传输
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 ml-1 leading-relaxed">
              {mode === 'share'
                ? '共享中心模式：所有设备均可查看并下载已分享的文件。'
                : '单向传输模式：其他设备仅可上传文件，不可查看已分享内容（仅本机可见）。'}
            </p>
          </div>

          {/* Groups: Remote create setting */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">分组权限</label>
            <div 
              className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => setAllowRemoteGroupCreate(v => !v)}
            >
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${allowRemoteGroupCreate ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                 {allowRemoteGroupCreate && <CheckCircle size={14} className="text-white" />}
              </div>
              <span className="text-sm text-slate-700">允许其他设备创建分组</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 ml-1">仅本机可修改，关闭后其他设备将无法创建分组。</p>
          </div>

          {/* Keep shooting date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">保留图片拍摄日期</label>
            <div 
              className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => setUseSourceDate(v => !v)}
            >
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${useSourceDate ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                 {useSourceDate && <CheckCircle size={14} className="text-white" />}
              </div>
              <span className="text-sm text-slate-700">上传图片时，尝试将文件的创建日期设置为 EXIF 拍摄时间</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            取消
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all active:scale-95">
            保存更改
          </button>
        </div>
      </div>
    </div>
  );
};

const InputModal = ({
  isOpen,
  onClose,
  title,
  placeholder,
  defaultValue = '',
  onConfirm,
  isPassword = false
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  isPassword?: boolean;
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-sm text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <input
              ref={inputRef}
              type={isPassword ? "password" : "text"}
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              placeholder={placeholder}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
            >
              确认
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const EditGroupModal = ({
  isOpen,
  onClose,
  group,
  groups,
  onUpdate
}: {
  isOpen: boolean;
  onClose: () => void;
  group: GroupItem | null;
  groups: GroupItem[];
  onUpdate: (gid: string, name: string, parentId: string) => Promise<void>;
}) => {
  const [name, setName] = useState('');
  const [selectedParent, setSelectedParent] = useState('root');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && group) {
      setName(group.name);
      setSelectedParent(group.parent_id || 'root');
    }
  }, [isOpen, group]);

  if (!isOpen || !group) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onUpdate(group.id, name.trim(), selectedParent);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Filter out the group itself and its children to prevent cycles (basic check)
  // A robust check would traverse children, but here we just exclude self.
  // Actually, moving a group into its own child is a cycle.
  // For simplicity, let's just exclude self. The backend has cycle detection.
  const validParents = flattenTree(buildGroupTree(groups)).filter(g => g.id !== group.id);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-800">编辑分组</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">父级分组</label>
            <select
              value={selectedParent}
              onChange={e => setSelectedParent(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
               {validParents.map(g => (
                 <option key={g.id} value={g.id}>
                   {'\u00A0'.repeat(g.depth * 2) + (g.id === 'root' ? '根目录' : g.name)}
                 </option>
               ))}
            </select>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">分组名称</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              placeholder="输入分组名称..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
            >
              {loading ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const GroupCreateModal = ({
  isOpen,
  onClose,
  parentId,
  groups,
  onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  parentId: string;
  groups: GroupItem[];
  onCreated: () => void;
}) => {
  const [name, setName] = useState('');
  const [selectedParent, setSelectedParent] = useState(parentId);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { setSelectedParent(parentId); }, [parentId]);

  if (!isOpen) return null;

  const parentName = parentId === 'root' ? '根目录' : (groups.find(g => g.id === parentId)?.name || '未知分组');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parent_id: selectedParent })
      });
      const data = await res.json();
      if (res.ok) {
        setName('');
        onCreated();
        onClose();
      } else {
        showToast(data.error || '创建失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-800">新建分组</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">父级分组</label>
            <select
              value={selectedParent}
              onChange={e => setSelectedParent(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
               {flattenTree(buildGroupTree(groups)).map(g => (
                 <option key={g.id} value={g.id}>
                   {'\u00A0'.repeat(g.depth * 2) + (g.id === 'root' ? '根目录' : g.name)}
                 </option>
               ))}
            </select>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">分组名称</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              placeholder="输入分组名称..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
            >
              {loading ? '创建中...' : '创建分组'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const ConfirmationModal = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = '确定',
  cancelText = '取消',
  type = 'danger'
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-slate-600 text-sm whitespace-pre-wrap">{message}</p>
        </div>
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all ${
              type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const DeleteGroupModal = ({
  isOpen,
  onClose,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteFiles: boolean) => void;
}) => {
  const [deleteFiles, setDeleteFiles] = useState(false);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-800">删除分组</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-slate-600 text-sm">确定要删除该分组吗？</p>
          <div className="flex items-center gap-2">
             <input 
                type="checkbox" 
                id="delFiles" 
                checked={deleteFiles} 
                onChange={e => setDeleteFiles(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
             />
             <label htmlFor="delFiles" className="text-sm text-slate-700 select-none">同时删除分组内的文件</label>
          </div>
          {!deleteFiles && <p className="text-xs text-slate-400">如果不勾选，文件将被移动到根目录或父级分组。</p>}
        </div>
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => { onConfirm(deleteFiles); onClose(); }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all"
          >
            确定删除
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const PreviewModal = ({
  isOpen,
  onClose,
  file,
  password
}: {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  password?: string;
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [zipFiles, setZipFiles] = useState<{name: string, size: number, date: string}[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [csvData, setCsvData] = useState<{headers: string[], rows: string[][]} | null>(null);
  const [hexData, setHexData] = useState<{offset: string, hex: string, ascii: string}[] | null>(null);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [externalType, setExternalType] = useState<'html'|'pdf'|null>(null);

  useEffect(() => {
      if (!isOpen || !file) return;
      setContent(null);
      setZipFiles(null);
      setError(null);
      setLoading(false);
      setCsvData(null);
      setHexData(null);
      setExternalUrl(null);
      setExternalType(null);
      if (containerRef.current) containerRef.current.innerHTML = '';

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isText = ['txt', 'md', 'log', 'js', 'py', 'java', 'xml', 'json', 'css', 'html', 'ts', 'tsx', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'sh', 'bat', 'ini', 'yaml', 'yml', 'sql', 'properties', 'conf'].includes(ext);
      const isZip = ['zip', 'jar'].includes(ext);
      const isDocx = ext === 'docx';
      const isXlsx = ['xlsx', 'xls', 'csv'].includes(ext);
      const isCsv = ext === 'csv';
      const isBin = ['bin', 'multi', 'dat', 'exe', 'dll', 'so', 'dylib'].includes(ext);
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
      const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
      const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
      const isPdf = ext === 'pdf';
      const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
      
      const url = `/download/${encodeURIComponent(file.name)}?preview=true` + (password ? `&password=${encodeURIComponent(password)}` : '');

      if (isText && !isCsv) {
          setLoading(true);
          fetch(url)
             .then(r => {
                 if (r.ok) return r.text();
                 throw new Error('Load failed');
             })
             .then(t => setContent(t))
             .catch(e => setError(e.message))
             .finally(() => setLoading(false));
      } else if (isZip) {
          setLoading(true);
          fetch('/api/zip/list', {
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({filename: file.name, password})
          })
             .then(r => r.json())
             .then(data => {
                 if (data.error) throw new Error(data.error);
                 setZipFiles(data.files);
             })
             .catch(e => setError(e.message))
             .finally(() => setLoading(false));
      } else if (isDocx) {
          setLoading(true);
          fetch(url)
            .then(res => res.blob())
            .then(blob => {
               console.log('DOCX Preview: Blob size', blob.size);
               if (containerRef.current) {
                  // Ensure container is visible
                  containerRef.current.style.display = 'block';
                  
                  renderAsync(blob, containerRef.current, containerRef.current, {
                      className: "docx-wrapper",
                      inWrapper: true,
                      ignoreWidth: false,
                      ignoreHeight: false,
                      ignoreFonts: false,
                      breakPages: true,
                      ignoreLastRenderedPageBreak: true,
                      experimental: false,
                      trimXmlDeclaration: true,
                      useBase64URL: false,
                      debug: true,
                  })
                  .then(() => {
                      console.log('DOCX Render Success');
                      setLoading(false);
                  })
                  .catch(e => {
                      console.error('DOCX Render Error', e);
                      setError('预览失败: ' + e.message);
                  });
               }
            })
            .catch(e => setError('加载失败: ' + e.message));
      } else if (isXlsx && !isCsv) { // Excel
          setLoading(true);
          fetch(url)
            .then(res => res.arrayBuffer())
            .then(ab => {
               console.log('XLSX Preview: Bytes', ab.byteLength);
               try {
                   const wb = XLSX.read(ab, {type: 'array'});
                   const wsname = wb.SheetNames[0];
                   const ws = wb.Sheets[wsname];
                   const html = XLSX.utils.sheet_to_html(ws);
                   if (containerRef.current) {
                       containerRef.current.innerHTML = html;
                       // Add basic styles to the table
                       const table = containerRef.current.querySelector('table');
                       if (table) {
                           table.className = "w-full border-collapse text-sm";
                           table.querySelectorAll('td, th').forEach(el => {
                               el.className = "border border-slate-300 px-2 py-1";
                           });
                       }
                   }
                   setLoading(false);
               } catch (err: any) {
                   console.error('XLSX Render Error', err);
                   setError('Excel解析失败: ' + err.message);
               }
            })
            .catch(e => setError('加载失败: ' + e.message));
      } else if (isCsv) {
          setLoading(true);
          fetch(url)
            .then(res => res.text())
            .then(text => {
                Papa.parse(text, {
                    complete: (results) => {
                        if (results.data && results.data.length > 0) {
                            // Simple heuristic: assume first row is header if strings
                            const rows = results.data as string[][];
                            const headers = rows[0];
                            const dataRows = rows.slice(1);
                            setCsvData({headers, rows: dataRows});
                        } else {
                            setError('CSV 文件为空');
                        }
                        setLoading(false);
                    },
                    error: (err) => {
                        setError('CSV 解析失败: ' + err.message);
                        setLoading(false);
                    }
                });
        })
            .catch(e => setError('加载失败: ' + e.message));
      } else if (isBin || !isText && !isImage && !isVideo && !isAudio && !isPdf && !isZip && !isOffice) {
          // Try Hex View for bin/multi or unknown files
          setLoading(true);
          fetch(url)
            .then(res => res.arrayBuffer())
            .then(buffer => {
                const maxBytes = 4096; // Only read first 4KB
                const view = new DataView(buffer.slice(0, maxBytes));
                const rows = [];
                for (let i = 0; i < view.byteLength; i += 16) {
                    const chunk = [];
                    const ascii = [];
                    for (let j = 0; j < 16 && i + j < view.byteLength; j++) {
                        const byte = view.getUint8(i + j);
                        chunk.push(byte.toString(16).padStart(2, '0'));
                        ascii.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
                    }
                    rows.push({
                        offset: i.toString(16).padStart(8, '0'),
                        hex: chunk.join(' ').padEnd(47, ' '),
                        ascii: ascii.join('')
                    });
                }
                setHexData(rows);
                setLoading(false);
            })
            .catch(e => setError('加载失败: ' + e.message));
      }

      // Office (doc/ppt/pptx) via backend conversion
      if (isOffice && !isDocx && !isXlsx && !isCsv) {
          setLoading(true);
          fetch('/api/office/preview', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ filename: file.name, password })
          })
            .then(r => r.json())
            .then(info => {
                if (info.error) throw new Error(info.error);
                setExternalUrl(info.url);
                setExternalType(info.type);
            })
            .catch(e => setError('预览转换失败: ' + e.message))
            .finally(() => setLoading(false));
      }

  }, [isOpen, file, password]);

  if (!isOpen || !file) return null;

  const url = `/download/${encodeURIComponent(file.name)}?preview=true` + (password ? `&password=${encodeURIComponent(password)}` : '');
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
  const isPdf = ext === 'pdf';
  const isCsv = ext === 'csv';
  const isText = !isCsv && ['txt', 'md', 'log', 'js', 'py', 'java', 'xml', 'json', 'css', 'html', 'ts', 'tsx', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'sh', 'bat', 'ini', 'yaml', 'yml', 'sql', 'properties', 'conf'].includes(ext);
  const isZip = ['zip', 'jar'].includes(ext);
  const isDocx = ext === 'docx';
  const isXlsx = ['xlsx', 'xls'].includes(ext);
  const isHex = hexData !== null; // If we have hex data, show it

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
      <div className="relative w-full h-full flex flex-col items-center justify-center max-w-6xl mx-auto">
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors z-50"
        >
          <X size={24} />
        </button>
        
        <div className="w-full h-full flex items-center justify-center overflow-auto rounded-lg" onClick={(e) => e.stopPropagation()}>
          {loading && <div className="text-white animate-pulse">加载中...</div>}
          {error && <div className="text-red-400 bg-black/50 p-4 rounded-lg">{error}</div>}
          
          {!loading && !error && (
              <>
                  {isImage && (
                    <img 
                      src={url} 
                      alt={file.name} 
                      className="max-w-full max-h-full object-contain shadow-2xl" 
                    />
                  )}
                  
                  {isVideo && (
                    <video 
                      src={url} 
                      controls 
                      autoPlay 
                      className="max-w-full max-h-full shadow-2xl bg-black"
                    />
                  )}

                  {isAudio && (
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 min-w-[300px]">
                        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                            <Music size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 break-all text-center max-w-sm">{file.name}</h3>
                        <audio src={url} controls className="w-full" autoPlay />
                    </div>
                  )}
                  
                  {(isPdf || externalType === 'pdf') && (
                    <iframe 
                      src={externalType === 'pdf' && externalUrl ? externalUrl : url} 
                      className="w-full h-full bg-white shadow-2xl rounded-lg"
                    />
                  )}

                  {isText && content !== null && (
                      <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-auto p-6">
                          <pre className="font-mono text-sm text-slate-800 whitespace-pre-wrap break-words">{content}</pre>
                      </div>
                  )}
                  {externalType === 'html' && externalUrl && (
                      <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden max-w-6xl h-[80vh]">
                          <div className="bg-slate-50 p-2 border-b border-slate-100 flex justify-between items-center px-4 shrink-0">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <FileSpreadsheet size={14} />
                                  <span>文档预览</span>
                              </div>
                              <a 
                                href={externalUrl} 
                                download 
                                className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors"
                              >
                                下载文件
                              </a>
                          </div>
                          <iframe src={externalUrl} className="w-full flex-1 overflow-auto bg-white" />
                      </div>
                  )}

                  {isZip && zipFiles && (
                      <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-w-3xl max-h-[80vh]">
                          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0">
                              <div className="flex items-center gap-2">
                                  <Archive size={18} className="text-slate-500" />
                                  <h3 className="font-medium text-slate-900">压缩包内容</h3>
                              </div>
                              <span className="text-xs text-slate-500">{zipFiles.length} 个文件</span>
                          </div>
                          <div className="overflow-auto flex-1 p-2">
                              <table className="w-full text-left text-sm">
                                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                      <tr>
                                          <th className="px-4 py-2">文件名</th>
                                          <th className="px-4 py-2 text-right">大小</th>
                                          <th className="px-4 py-2 text-right">日期</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {zipFiles.map((f, i) => (
                                          <tr key={i} className="hover:bg-slate-50">
                                              <td className="px-4 py-2 font-mono text-slate-700 break-all">{f.name}</td>
                                              <td className="px-4 py-2 text-right text-slate-500 whitespace-nowrap">{formatSize(f.size)}</td>
                                              <td className="px-4 py-2 text-right text-slate-500 whitespace-nowrap">{f.date}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  )}
                  
                  {isCsv && csvData && (
                      <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-w-6xl h-[80vh]">
                           <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                               <span className="text-sm font-semibold text-slate-700">CSV 预览</span>
                               <a href={url} download className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50">下载</a>
                           </div>
                           <div className="overflow-auto flex-1 p-4">
                               <table className="w-full border-collapse text-sm">
                                   <thead>
                                       <tr>
                                           {csvData.headers.map((h, i) => (
                                               <th key={i} className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">{h}</th>
                                           ))}
                                       </tr>
                                   </thead>
                                   <tbody>
                                       {csvData.rows.map((row, i) => (
                                           <tr key={i} className="hover:bg-slate-50">
                                               {row.map((cell, j) => (
                                                   <td key={j} className="border border-slate-300 px-3 py-2 text-slate-600">{cell}</td>
                                               ))}
                                           </tr>
                                       ))}
                                   </tbody>
                               </table>
                           </div>
                      </div>
                  )}

                  {isHex && hexData && (
                      <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-w-5xl h-[80vh]">
                          <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                               <div className="flex items-center gap-2">
                                   <FileType size={16} />
                                   <span className="text-sm font-semibold text-slate-700">二进制/文本预览 (前 4KB)</span>
                               </div>
                               <a href={url} download className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50">下载</a>
                           </div>
                           <div className="overflow-auto flex-1 p-4 bg-slate-900 text-slate-200 font-mono text-xs">
                               {hexData.map((row, i) => (
                                   <div key={i} className="flex gap-4 hover:bg-slate-800">
                                       <span className="text-slate-500 select-none">{row.offset}</span>
                                       <span className="text-indigo-300">{row.hex}</span>
                                       <span className="text-emerald-300 opacity-70 border-l border-slate-700 pl-4">{row.ascii}</span>
                                   </div>
                               ))}
                           </div>
                      </div>
                  )}

                  {(isDocx || isXlsx) && (
                      <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden max-w-6xl h-[80vh]">
                          <div className="bg-slate-50 p-2 border-b border-slate-100 flex justify-between items-center px-4 shrink-0">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <FileSpreadsheet size={14} />
                                  <span>文档预览</span>
                              </div>
                              <a 
                                href={url} 
                                download 
                                className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors"
                              >
                                下载文件
                              </a>
                          </div>
                          <div 
                            ref={containerRef} 
                            className="w-full flex-1 overflow-auto bg-white p-8 docx-container" 
                            style={{ minHeight: '500px' }}
                          />
                      </div>
                  )}
              </>
          )}
        </div>
        
        <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
          <p className="text-white/80 text-sm bg-black/50 inline-block px-3 py-1 rounded-full backdrop-blur-md">
            {file.name}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- Main App Component ---

const ToastContext = React.createContext<{ showToast: (msg: string, type?: 'info' | 'error' | 'success') => void }>({ showToast: () => {} });
const useToast = () => React.useContext(ToastContext);

const Home = () => {
  const { t, i18n } = useTranslation();
  const [config, setConfig] = useState<IpResponse | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'info' | 'error' | 'success' } | null>(null);
  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => setToast({ message, type });
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: FileItem, password?: string } | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [username, setUsername] = useState<string>(localStorage.getItem('last_username') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'files' | 'text'>('files');
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('root');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({ root: true });
  const [showGroupModal, setShowGroupModal] = useState<{open: boolean, parent: string}>({ open: false, parent: 'root' });
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [editGroupModal, setEditGroupModal] = useState<{ open: boolean; group: GroupItem | null }>({ open: false, group: null });
  const [inputModal, setInputModal] = useState<{
    open: boolean;
    title: string;
    placeholder?: string;
    defaultValue?: string;
    isPassword?: boolean;
    onConfirm: (val: string) => void;
  }>({ open: false, title: '', onConfirm: () => {} });

  const [confirmationModal, setConfirmationModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info';
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const [deleteGroupModal, setDeleteGroupModal] = useState<{
    open: boolean;
    groupId: string | null;
  }>({ open: false, groupId: null });

  const ipAddress = (() => {
    const wl = typeof window !== 'undefined' ? window.location : null;
    const host = wl ? wl.hostname : '';
    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(host);
    if (isLoopback) {
      if (!config) return null;
      const ip = config.ip || '';
      const port = config.port;
      const proto = (config as any).proto ? `${(config as any).proto}:` : (wl ? wl.protocol : 'http:');
      const bracketed = ip.includes(':') && !ip.startsWith('[') ? `[${ip}]` : ip;
      return `${proto}//${bracketed}${port ? `:${port}` : ''}`;
    }
    if (wl) return `${wl.protocol}//${wl.hostname}${wl.port ? `:${wl.port}` : ''}`;
    if (config) {
      const ip = config.ip || '';
      const port = config.port;
      const proto = (config as any).proto ? `${(config as any).proto}:` : 'http:';
      const bracketed = ip.includes(':') && !ip.startsWith('[') ? `[${ip}]` : ip;
      return `${proto}//${bracketed}${port ? `:${port}` : ''}`;
    }
    return null;
  })();
  const isHost = config?.is_host;

  const handlePreview = (file: FileItem, password?: string) => {
     if (file.has_password && !password) {
        setInputModal({
            open: true,
            title: '查看预览',
            placeholder: '该文件已加密，请输入密码',
            isPassword: true,
            onConfirm: (pwd) => setPreviewFile({ file, password: pwd })
        });
     } else {
        setPreviewFile({ file, password });
     }
  };

  // Initialize Data and Auth
  useEffect(() => {
    initTCB();
    recordInstall();
    recordDailyActive();

    fetch('/api/ip')
      .then(res => res.json())
      .then((data: IpResponse) => {
        // Fix for Docker/NAS: If browser is using a non-localhost IP, use it instead of server-reported internal IP
        if (typeof window !== 'undefined' && window.location && window.location.hostname) {
            const host = window.location.hostname;
            if (host !== 'localhost' && host !== '127.0.0.1') {
                data.ip = host;
                const portStr = window.location.port;
                data.port = portStr ? parseInt(portStr, 10) : (window.location.protocol === 'https:' ? 443 : 80);
            }
        }
        setConfig(data);
      })
      .catch(console.error);

    // Check Token
    const token = localStorage.getItem('token');
    
    const logToServer = (msg: string) => {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      }).catch(() => {});
    };

    logToServer(`App mounted. Token exists: ${!!token}`);

    if (token) {
      logToServer(`Verifying token: ${token.substring(0, 8)}...`);
      fetch('/api/user/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      .then(res => {
        logToServer(`Auth response status: ${res.status}`);
        if (res.ok) return res.json();
        if (res.status === 401) {
          // Explicitly invalid token
          logToServer("Token invalid (401), clearing.");
          localStorage.removeItem('token');
          setIsLoggedIn(false);
        }
        throw new Error(`auth failed with status ${res.status}`);
      })
      .then(data => {
        logToServer(`Auth success for user: ${data.username}`);
        setIsLoggedIn(true);
        setUsername(data.username);
        localStorage.setItem('last_username', data.username);
      })
      .catch((err) => {
        logToServer(`Auth check error: ${err}`);
        console.error("Auth check error:", err);
        // Do NOT wipe token on network errors or other failures
        // Just don't log in automatically this time
        setIsLoggedIn(false);
      });
    } else {
      logToServer("No token in localStorage");
      setIsLoggedIn(false);
    }

    const load = () => { fetchFiles(); fetchTexts(); fetchGroups(); };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (token: string, user: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('last_username', user);
    setUsername(user);
    setIsLoggedIn(true);
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch('/api/user/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch (e) { console.error(e); }
    }
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    // Keep username for "Default login last logged-in local name" display (optional)
    // But here we might want to show it in the input field when they try to login again
  };

  const handleSaveConfig = async (newConfig: Partial<IpResponse>) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        // refresh config
        const ipRes = await fetch('/api/ip');
        const ipData = await ipRes.json();
        setConfig(ipData);
        // reload files if path changed
        fetchFiles();
      } else {
        showToast('设置保存失败', 'error');
      }
    } catch { showToast('网络错误', 'error'); }
  };

  const fetchFiles = async (queryOverride?: string) => {
    try {
      const params = new URLSearchParams();
      const q = queryOverride !== undefined ? queryOverride : searchQueryRef.current;
      if (q.trim()) params.set('q', q.trim());
      // Removed group_id filtering to ensure all files are loaded for the tree view
      const res = await fetch(`/api/files?${params.toString()}`);
      const data = await res.json();
      data.sort((a: FileItem, b: FileItem) => (b.mtime || 0) - (a.mtime || 0));
      setFiles(prev => {
        const prevSig = JSON.stringify(prev);
        const newSig = JSON.stringify(data);
        return prevSig === newSig ? prev : data;
      });
    } catch (err) {
      console.error("Failed to load files", err);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      setGroups(prev => {
        const prevSig = JSON.stringify(prev);
        const newSig = JSON.stringify(data);
        return prevSig === newSig ? prev : data;
      });
      setGroupExpanded(prev => ({ root: true, ...prev }));
    } catch (err) {
      console.error('Failed to load groups', err);
    }
  };

  const fetchTexts = async () => {
    try {
      const res = await fetch('/api/texts');
      const data = await res.json();
      data.sort((a: TextItem, b: TextItem) => (b.mtime || 0) - (a.mtime || 0));
      setTexts(prev => {
        const prevSig = JSON.stringify(prev);
        const newSig = JSON.stringify(data);
        return prevSig === newSig ? prev : data;
      });
    } catch (err) {
      console.error('Failed to load texts', err);
    }
  };

  const handleUpload = (fileList: FileList, password?: string, groupIdOverride?: string) => {
    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('file', fileList[i]);
    }
    // If logged in, use username. If not, use '访客' or similar, or just send empty and let backend decide.
    // But requirement says: "Default login last logged-in local name".
    // If not logged in, we still might want to attribute it to a name if they set one?
    // The prompt says: "If not logged in, cannot set file/text access password".
    // It doesn't say they cannot upload.
    // We'll send username if available, or empty.
    formData.append('uploader', username || '访客');
    formData.append('group_id', (groupIdOverride || activeGroupId || 'root'));
    if (password) formData.append('password', password);

    setIsUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status === 201) {
        // Record stats
        let totalSize = 0;
        for (let i = 0; i < fileList.length; i++) totalSize += fileList[i].size;
        recordFileStats('upload', fileList.length, totalSize);

        fetchFiles();
        // Clear progress after short delay for better UX
        setTimeout(() => setUploadProgress(0), 500);
      } else {
        showToast('上传失败', 'error');
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      showToast('网络错误', 'error');
    };

    xhr.send(formData);
  };

  const handleShareText = async (content: string, password?: string) => {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('uploader', username || '访客');
    if (password) formData.append('password', password);
    try {
      const res = await fetch('/api/texts', { method: 'POST', body: formData });
      if (res.status === 201) {
        fetchTexts();
      } else {
        showToast('分享失败', 'error');
      }
    } catch (e) { showToast('网络错误', 'error'); }
  };

  const handleDelete = (fileName: string) => {
    setConfirmationModal({
      open: true,
      title: '删除文件',
      message: `确定要删除 ${fileName} 吗?`,
      confirmText: '删除',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/files/${encodeURIComponent(fileName)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploader: username })
          });
          if (res.ok) fetchFiles();
          else showToast('删除失败：可能不是该文件的上传者', 'error');
        } catch (e) { showToast('操作失败', 'error'); }
      }
    });
  };

  const handleSetPassword = async (fileName: string, isLocked: boolean) => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    const title = isLocked ? '修改/清除密码' : '设置下载密码';
    const placeholder = isLocked ? '输入新密码（留空则清除）' : '输入密码';
    
    setInputModal({
        open: true,
        title,
        placeholder,
        isPassword: true,
        onConfirm: async (newPwd) => {
            const isClear = (newPwd || '').trim() === '';
            try {
              const res = await fetch(`/api/files/${encodeURIComponent(fileName)}/password`, {
                method: isClear ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uploader: username,
                  ...(!isClear && { password: newPwd.trim() })
                })
              });
              if (res.ok) fetchFiles();
              else showToast('操作失败', 'error');
            } catch (e) { showToast('网络错误', 'error'); }
        }
    });
  };



  const handleDeleteText = (id: string) => {
    setConfirmationModal({
      open: true,
      title: '删除文字',
      message: '确定要删除该文字吗?',
      confirmText: '删除',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/texts/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploader: username })
          });
          if (res.ok) fetchTexts();
          else showToast('删除失败：可能不是该文字的上传者', 'error');
        } catch (e) { showToast('操作失败', 'error'); }
      }
    });
  };

  const handleSetTextPassword = async (id: string, isLocked: boolean) => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    const title = isLocked ? '修改/清除密码' : '设置访问密码';
    const placeholder = isLocked ? '输入新密码（留空则清除）' : '输入密码';

    setInputModal({
        open: true,
        title,
        placeholder,
        isPassword: true,
        onConfirm: async (newPwd) => {
            const isClear = (newPwd || '').trim() === '';
            try {
              const res = await fetch(`/api/texts/${encodeURIComponent(id)}/password`, {
                method: isClear ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploader: username, ...(!isClear && { password: newPwd.trim() }) })
              });
              if (res.ok) fetchTexts();
              else showToast('操作失败', 'error');
            } catch (e) { showToast('网络错误', 'error'); }
        }
    });
  };

  const handleEditGroup = (group: GroupItem) => {
    setEditGroupModal({ open: true, group });
  };

  const handleUpdateGroup = async (gid: string, name: string, parentId: string) => {
    try {
      const res = await fetch(`/api/groups/${gid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId })
      });
      if (res.ok) {
        showToast('分组更新成功', 'success');
        fetchGroups();
      } else {
        const data = await res.json();
        showToast(data.error || '更新失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    }
  };

  const handlePinGroup = async (gid: string, isPinned: boolean) => {
    try {
      const res = await fetch(`/api/groups/${gid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: isPinned })
      });
      if (res.ok) {
        fetchGroups();
      } else {
        showToast('操作失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    }
  };

  const handleDownload = (file: FileItem) => {
    recordFileStats('download', 1, file.size);
    const downloadUrl = `/download/${encodeURIComponent(file.name)}`;
    if (file.has_password) {
      setInputModal({
        open: true,
        title: '下载文件',
        placeholder: '请输入下载密码',
        isPassword: true,
        onConfirm: (pwd) => {
           window.location.href = `${downloadUrl}?password=${encodeURIComponent(pwd)}`;
        }
      });
    } else {
      window.location.href = downloadUrl;
    }
  };

  const handleCopyLink = (file: FileItem) => {
     const origin = window.location.origin;
     const downloadUrl = `/download/${encodeURIComponent(file.name)}`;
     let link = `${origin}${downloadUrl}`;
     
     if (file.has_password) {
       setInputModal({
         open: true,
         title: '复制链接',
         placeholder: '请输入用于复制的下载链接密码',
         isPassword: true,
         onConfirm: (pwd) => {
            link += `?password=${encodeURIComponent(pwd)}`;
            safeCopyText(link).then(() => showToast('链接已复制到剪贴板', 'success'));
         }
       });
     } else {
       safeCopyText(link).then(() => showToast('链接已复制到剪贴板', 'success'));
     }
  };

  const handleCopyText = (item: TextItem) => {
    const display = item.content || '';
    if (item.has_password) {
       setInputModal({
         open: true,
         title: '复制文字',
         placeholder: '该文字已设置密码，请输入密码',
         isPassword: true,
         onConfirm: async (pwd) => {
             try {
                const res = await fetch(`/api/texts/${encodeURIComponent(item.id)}?password=${encodeURIComponent(pwd)}`);
                if (!res.ok) { showToast('密码错误或复制失败', 'error'); return; }
                const data = await res.json();
                safeCopyText(data.content || '').then(() => showToast('文字已复制到剪贴板', 'success'));
             } catch { showToast('网络错误', 'error'); }
         }
       });
    } else {
       safeCopyText(display).then(() => showToast('文字已复制到剪贴板', 'success'));
    }
  };

  const groupTreeNodes = useMemo(() => buildGroupTree(groups), [groups]);

  const handleDrop = async (targetGroupId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroup(null);
    try {
      const t = e.dataTransfer.getData('application/json');
      const o = JSON.parse(t || '{}');
      if (o && o.t === 'file' && o.name) {
         const res = await fetch(`/api/files/${encodeURIComponent(o.name)}/group`, {
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ group_id: targetGroupId })
         });
         if (res.ok) {
             setGroupExpanded(prev => ({ ...prev, [targetGroupId]: true }));
             fetchFiles();
         } else {
             showToast('移动失败', 'error');
         }
      }
    } catch (err) {
        console.error(err);
    }
  };

  const handleHideGroup = async (id: string, hidden: boolean) => {
      try { 
          const r = await fetch(`/api/groups/${encodeURIComponent(id)}/hidden`, { 
              method:'POST', 
              headers:{'Content-Type':'application/json'}, 
              body: JSON.stringify({hidden}) 
          }); 
          if (r.ok) fetchGroups(); 
      } catch {}
  };

  const handleDeleteGroup = (id: string) => {
      setDeleteGroupModal({ open: true, groupId: id });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans selection:bg-slate-200 selection:text-slate-900 pb-12">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
      <PreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile?.file || null}
        password={previewFile?.password}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config || { ip: '', port: 0 } as IpResponse}
        onSave={handleSaveConfig}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12">

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* --- SIDEBAR (Controls) --- */}
          <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-6 lg:sticky lg:top-8 animate-fade-in z-10">
            <UserProfileCard
              ipAddress={ipAddress}
              username={username}
              isLoggedIn={isLoggedIn}
              onLogin={() => setShowAuthModal(true)}
              onLogout={handleLogout}
              isHost={isHost}
              onOpenSettings={() => setShowSettings(true)}
            />

            <div className="space-y-3">
              <SectionHeader icon={Upload} title="文件传输" />
              <UploadCard
                onUpload={handleUpload}
                onShareText={handleShareText}
                isUploading={isUploading}
                progress={uploadProgress}
                isLoggedIn={isLoggedIn}
                onLoginRequired={() => setShowAuthModal(true)}
                groups={groups}
                selectedGroupId={activeGroupId}
                onChangeGroup={(id) => setActiveGroupId(id)}
              />
            </div>

            

            <div className="bg-slate-100 rounded-xl p-4 border border-slate-200/50">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <div className="flex items-center gap-2">
                  <HelpCircle size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">帮助</span>
                </div>
                {config?.version && (
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">v{config.version}</span>
                )}
              </div>
              <ul className="space-y-1.5 text-xs text-slate-500 ml-1">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                  同一 Wi-Fi 下设备可互传
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                  上传者可管理自己的文件
                </li>
              </ul>
              <a
                href="https://npr2t23ep2.feishu.cn/wiki/NsyVwd8x2ia3xukCP8vcxSYdnc0"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 mt-3 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                软件更新&联系作者
                <ExternalLink size={10} />
              </a>
              {(['localhost', '127.0.0.1'].includes((typeof window !== 'undefined' && window.location && window.location.hostname) || '')) && (
                <button
                  onClick={() => {
                    setConfirmationModal({
                      open: true,
                      title: '退出程序',
                      message: '确定退出 QuickSend 吗？',
                      confirmText: '退出',
                      type: 'danger',
                      onConfirm: async () => {
                        try {
                          await fetch('/api/exit', { method: 'POST' });
                          try { window.open('', '_self'); } catch { }
                          try { window.close(); } catch { }
                          setTimeout(() => { try { window.location.replace('about:blank'); } catch { } }, 100);
                        } catch { }
                      }
                    });
                  }}
                  className="mt-3 w-full px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50"
                >
                  退出程序（仅本机）
                </button>
              )}

              
            </div>
          </aside>

          {/* --- MAIN CONTENT (Files) --- */}
          {(!isHost && config?.mode === 'oneway') ? (
            <main className="flex-1 w-full min-w-0 flex flex-col items-center justify-center text-slate-400 py-20 bg-white rounded-2xl border border-slate-100 shadow-sm h-[calc(100vh-10rem)]">
              <Shield size={48} className="mb-4 text-slate-300" />
              <p className="font-medium text-lg text-slate-600">当前处于单向传输模式</p>
              <p className="text-sm mt-2 text-slate-500">仅支持上传文件，不可查看已分享内容</p>
            </main>
          ) : (
            <main className="flex-1 w-full min-w-0 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              {/* Tab Navigation */}
              <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-3">
                <button
                  onClick={() => setActiveTab('files')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'files'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                  <HardDrive size={16} />
                  <span>已分享文件</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${activeTab === 'files' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                    {files.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'text'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                  <Share2 size={16} />
                  <span>已分享文字</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${activeTab === 'text' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                    {texts.length}
                  </span>
                </button>
              </div>

              {activeTab === 'files' && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1">
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { setSearchQuery(searchInput.trim()); fetchFiles(searchInput.trim()); } }}
                      placeholder="搜索文件（支持模糊）"
                      className="w-full pl-8 pr-8 h-9 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    {searchInput && (
                      <button 
                        onClick={() => { setSearchInput(''); setSearchQuery(''); fetchFiles(''); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button onClick={() => { setSearchQuery(searchInput.trim()); fetchFiles(searchInput.trim()); }} className="px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors">确认搜索</button>

                  {(isHost || config?.allow_remote_group_create) && (
                    <button
                      onClick={() => setShowGroupModal({ open: true, parent: 'root' })}
                      className="w-9 h-9 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 transition-colors"
                      title="新建分组"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'files' && (
                <div className="flex flex-col gap-2 mb-4">
                  <GroupCreateModal
                    isOpen={showGroupModal.open}
                    onClose={() => setShowGroupModal({open:false,parent:'root'})}
                    parentId={showGroupModal.parent}
                    groups={groups}
                    onCreated={() => { fetchGroups(); }}
                  />
                  <EditGroupModal
                    isOpen={editGroupModal.open}
                    onClose={() => setEditGroupModal({ open: false, group: null })}
                    group={editGroupModal.group}
                    groups={groups}
                    onUpdate={handleUpdateGroup}
                  />
                  <DeleteGroupModal
                    isOpen={deleteGroupModal.open}
                    onClose={() => setDeleteGroupModal({ open: false, groupId: null })}
                    onConfirm={async (deleteFiles) => {
                      if (deleteGroupModal.groupId) {
                        const id = deleteGroupModal.groupId;
                        const r = await fetch(`/api/groups/${encodeURIComponent(id)}?mode=${deleteFiles ? 'delete_with_files' : 'delete_only'}`, { method: 'DELETE' });
                        if (r.ok) { fetchGroups(); fetchFiles(); }
                      }
                    }}
                  />
                  
                  <GroupTree
                     nodes={groupTreeNodes}
                     files={files}
                     expandedState={groupExpanded}
                     onToggle={(id: string) => setGroupExpanded(prev => ({ ...prev, [id]: !prev[id] }))}
                     isHost={isHost}
                     dragOverId={dragOverGroup}
                     onDragOver={setDragOverGroup}
                     onDragLeave={() => setDragOverGroup(null)}
                     onDrop={handleDrop}
                     onHide={handleHideGroup}
                     onDeleteGroup={handleDeleteGroup}
                     onEditGroup={handleEditGroup}
                     onPinGroup={handlePinGroup}
                     fileCardProps={{
                        currentUser: username,
                        onDelete: handleDelete,
                        onSetPassword: handleSetPassword,
                        onPreview: handlePreview,
                        onSetGroup: () => {},
                        onDownload: handleDownload,
                        onCopyLink: handleCopyLink,
                        groups: groups,
                        isHost: isHost,
                        isLoggedIn: isLoggedIn
                     }}
                  />
                </div>
              )}

              

              {/* Text Tab Content */}
              {activeTab === 'text' && (
                <div className="flex flex-col gap-3 pb-20">
                  {texts.map(item => (
                    <TextCard
                      key={item.id}
                      item={item}
                      currentUser={username}
                      onDelete={handleDeleteText}
                      onSetPassword={handleSetTextPassword}
                      onCopy={handleCopyText}
                      isLoggedIn={isLoggedIn}
                    />
                  ))}
                  {texts.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <p>暂无分享文字</p>
                    </div>
                  )}
                </div>
              )}
            </main>
          )}
        </div>
      </div>
      <InputModal
        isOpen={inputModal.open}
        onClose={() => setInputModal(prev => ({ ...prev, open: false }))}
        title={inputModal.title}
        placeholder={inputModal.placeholder}
        defaultValue={inputModal.defaultValue}
        isPassword={inputModal.isPassword}
        onConfirm={inputModal.onConfirm}
      />
      <ConfirmationModal
        isOpen={confirmationModal.open}
        onClose={() => setConfirmationModal(prev => ({ ...prev, open: false }))}
        title={confirmationModal.title}
        message={confirmationModal.message}
        onConfirm={confirmationModal.onConfirm}
        confirmText={confirmationModal.confirmText}
        cancelText={confirmationModal.cancelText}
        type={confirmationModal.type}
      />
      <Toast message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />
    </div>
    </ToastContext.Provider>
  );
};

export default Home;
