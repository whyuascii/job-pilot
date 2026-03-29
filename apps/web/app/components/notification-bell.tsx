import * as React from 'react';

import { useNavigate } from '@tanstack/react-router';
import {
  Bell,
  Briefcase,
  Check,
  CheckCheck,
  Info,
  MessageSquare,
  Star,
  TrendingUp,
} from 'lucide-react';

import { api } from '~/lib/api-client';

type Notification = {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

function getNotificationIcon(type: string) {
  switch (type) {
    case 'job_scored':
      return <TrendingUp className="h-4 w-4 text-sky-500" />;
    case 'application_updated':
      return <Briefcase className="h-4 w-4 text-amber-500" />;
    case 'high_score_job':
      return <Star className="h-4 w-4 text-emerald-500" />;
    case 'answer_suggestion':
      return <MessageSquare className="h-4 w-4 text-violet-500" />;
    case 'system':
    default:
      return <Info className="text-muted-foreground h-4 w-4" />;
  }
}

function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({});
  const navigate = useNavigate();

  // Fetch unread count on mount and periodically
  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const result = await api.notifications.getUnreadCount();
      setUnreadCount(result.count);
    } catch {
      // Silently fail - user may not be authenticated yet
    }
  }, []);

  React.useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full notifications when popover opens
  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.notifications.list();
      setNotifications(result);
      const unread = result.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Position the popover using fixed coordinates from the bell button
  React.useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 320;
      // Position below the button, aligned to the left edge of the button
      let left = rect.left;
      // If it would overflow the right edge, shift it left
      if (left + dropdownWidth > window.innerWidth - 8) {
        left = window.innerWidth - dropdownWidth - 8;
      }
      // Ensure it doesn't go off the left edge
      if (left < 8) left = 8;
      setPopoverStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left,
        width: dropdownWidth,
        zIndex: 9999,
      });
    }
  }, [open]);

  // Close popover when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await api.notifications.markRead({ notificationId: notification.id });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently fail
      }
    }

    // Navigate to link if present
    if (notification.link) {
      setOpen(false);
      navigate({ to: notification.link });
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:bg-accent hover:text-foreground relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown — fixed positioning to escape sidebar overflow */}
      {open && (
        <div ref={popoverRef} style={popoverStyle} className="bg-card rounded-lg border shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="border-muted-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="text-muted-foreground/40 mb-2 h-8 w-8" />
                <p className="text-muted-foreground text-sm">No notifications yet</p>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  You will see updates here as you use Job Pilot
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className={`hover:bg-accent/50 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        !notification.read ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div className="mt-0.5 shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-tight ${
                              !notification.read
                                ? 'text-foreground font-semibold'
                                : 'text-foreground/80'
                            }`}
                          >
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="bg-primary mt-1 h-2 w-2 shrink-0 rounded-full" />
                          )}
                        </div>
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                          {notification.message}
                        </p>
                        <p className="text-muted-foreground/60 mt-1 text-[10px]">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2">
              <p className="text-muted-foreground/60 text-center text-[10px]">
                Showing last {notifications.length} notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
