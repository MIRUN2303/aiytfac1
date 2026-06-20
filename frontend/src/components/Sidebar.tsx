"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, ListVideo, FolderOpen, Image,
  LayoutTemplate, Upload, ScrollText, Settings, Key, Puzzle,
  Server, ChevronLeft, ChevronRight, Radio, BookOpen,
} from "lucide-react";

const mainLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/guide", label: "Getting Started", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/queue", label: "Queue", icon: ListVideo },
  { href: "/projects", label: "Projects", icon: FolderOpen },
];

const contentLinks = [
  { href: "/media", label: "Media", icon: Image },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/uploads", label: "Uploads", icon: Upload },
];

const systemLinks = [
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/api-keys", label: "API Management", icon: Key },
  { href: "/plugins", label: "Plugin Manager", icon: Puzzle },
  { href: "/system", label: "System Status", icon: Server },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
          active
            ? "bg-accent/10 text-accent font-medium"
            : "text-muted hover:text-foreground hover:bg-neutral-800/50"
        }`}
        title={label}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={`relative flex flex-col bg-neutral-950/80 backdrop-blur-xl border-r border-border transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Radio size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm">AI YT Factory</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
            <Radio size={14} className="text-white" />
          </div>
        )}
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-14 w-6 h-6 rounded-full bg-neutral-900 border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        <div className="space-y-1">
          {!collapsed && <p className="text-xs font-medium text-muted px-3 uppercase tracking-wider">Main</p>}
          {mainLinks.map((l) => <NavItem key={l.href} {...l} />)}
        </div>
        <div className="space-y-1">
          {!collapsed && <p className="text-xs font-medium text-muted px-3 uppercase tracking-wider">Content</p>}
          {contentLinks.map((l) => <NavItem key={l.href} {...l} />)}
        </div>
        <div className="space-y-1">
          {!collapsed && <p className="text-xs font-medium text-muted px-3 uppercase tracking-wider">System</p>}
          {systemLinks.map((l) => <NavItem key={l.href} {...l} />)}
        </div>
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10">
          {!collapsed && (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">All Systems Go</span>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
