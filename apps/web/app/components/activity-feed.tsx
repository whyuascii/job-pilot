import * as React from 'react';

import { Link } from '@tanstack/react-router';
import {
  ArrowUpCircle,
  Check,
  Clock,
  ExternalLink,
  Ghost,
  Mail,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

import { Badge, Button } from '@job-pilot/ui';

export interface ActivityFeedItem {
  id: string;
  type: 'unreviewed_email' | 'ghosted_alert' | 'status_change' | 'auto_detected';
  title: string;
  description: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface ActivityFeedProps {
  items: ActivityFeedItem[];
  onConfirm: (itemId: string, itemType: string, action: string, data?: any) => Promise<void>;
  onQuickAdd: () => void;
}

function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getItemIcon(type: ActivityFeedItem['type']) {
  switch (type) {
    case 'unreviewed_email':
      return <Mail className="h-4 w-4 text-blue-500" />;
    case 'ghosted_alert':
      return <Ghost className="h-4 w-4 text-red-500" />;
    case 'auto_detected':
      return <Sparkles className="h-4 w-4 text-amber-500" />;
    case 'status_change':
      return <ArrowUpCircle className="h-4 w-4 text-indigo-500" />;
    default:
      return <Clock className="text-muted-foreground h-4 w-4" />;
  }
}

function getItemBadgeVariant(
  type: ActivityFeedItem['type'],
): 'default' | 'secondary' | 'destructive' {
  switch (type) {
    case 'unreviewed_email':
      return 'default';
    case 'ghosted_alert':
      return 'destructive';
    case 'auto_detected':
      return 'secondary';
    case 'status_change':
      return 'secondary';
    default:
      return 'default';
  }
}

function getItemLabel(type: ActivityFeedItem['type']): string {
  switch (type) {
    case 'unreviewed_email':
      return 'Email';
    case 'ghosted_alert':
      return 'Ghosted';
    case 'auto_detected':
      return 'Detected';
    case 'status_change':
      return 'Status';
    default:
      return 'Activity';
  }
}

function UnreviewedEmailActions({
  item,
  onConfirm,
  loading,
}: {
  item: ActivityFeedItem;
  onConfirm: ActivityFeedProps['onConfirm'];
  loading: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
        disabled={loading === item.id}
        onClick={() => onConfirm(item.id, item.type, 'confirm_status')}
      >
        <Check className="mr-1 h-3 w-3" />
        Confirm
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
        disabled={loading === item.id}
        onClick={() => onConfirm(item.id, item.type, 'dismiss')}
      >
        <X className="mr-1 h-3 w-3" />
        Dismiss
      </Button>
    </div>
  );
}

function GhostedAlertActions({
  item,
  onConfirm,
  loading,
}: {
  item: ActivityFeedItem;
  onConfirm: ActivityFeedProps['onConfirm'];
  loading: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {item.metadata?.applicationId ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          asChild
        >
          <Link
            to="/applications/$applicationId"
            params={{ applicationId: item.metadata.applicationId }}
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            Follow up
          </Link>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          disabled={loading === item.id}
          onClick={() => onConfirm(item.id, item.type, 'follow_up')}
        >
          <ExternalLink className="mr-1 h-3 w-3" />
          Follow up
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
        disabled={loading === item.id}
        onClick={() => onConfirm(item.id, item.type, 'dismiss')}
      >
        <X className="mr-1 h-3 w-3" />
        Dismiss
      </Button>
    </div>
  );
}

function AutoDetectedActions({
  item,
  onQuickAdd,
  onConfirm,
  loading,
}: {
  item: ActivityFeedItem;
  onQuickAdd: ActivityFeedProps['onQuickAdd'];
  onConfirm: ActivityFeedProps['onConfirm'];
  loading: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700"
        disabled={loading === item.id}
        onClick={() => onQuickAdd()}
      >
        <Plus className="mr-1 h-3 w-3" />
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
        disabled={loading === item.id}
        onClick={() => onConfirm(item.id, item.type, 'dismiss')}
      >
        <X className="mr-1 h-3 w-3" />
        Dismiss
      </Button>
    </div>
  );
}

export function ActivityFeed({ items, onConfirm, onQuickAdd }: ActivityFeedProps) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const sortedItems = React.useMemo(
    () =>
      [...items]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20),
    [items],
  );

  const handleConfirm = React.useCallback(
    async (itemId: string, itemType: string, action: string, data?: any) => {
      setLoadingId(itemId);
      try {
        await onConfirm(itemId, itemType, action, data);
      } finally {
        setLoadingId(null);
      }
    },
    [onConfirm],
  );

  return (
    <div className="bg-card rounded-xl border shadow">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Activity Feed</h3>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onQuickAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Quick Add
        </Button>
      </div>

      {/* Items */}
      <div className="max-h-[600px] overflow-y-auto">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="text-muted-foreground/40 mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">No new activity</p>
          </div>
        ) : (
          <ul className="divide-y">
            {sortedItems.map((item) => (
              <li
                key={item.id}
                className="hover:bg-accent/50 flex items-start gap-3 px-4 py-3 transition-colors"
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">{getItemIcon(item.type)}</div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium leading-tight">{item.title}</p>
                        <Badge
                          variant={getItemBadgeVariant(item.type)}
                          className="shrink-0 px-1.5 py-0 text-[10px]"
                        >
                          {getItemLabel(item.type)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                        {item.description}
                      </p>
                    </div>
                    <span className="text-muted-foreground/60 mt-0.5 shrink-0 text-[10px]">
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-1.5">
                    {item.type === 'unreviewed_email' && (
                      <UnreviewedEmailActions
                        item={item}
                        onConfirm={handleConfirm}
                        loading={loadingId}
                      />
                    )}
                    {item.type === 'ghosted_alert' && (
                      <GhostedAlertActions
                        item={item}
                        onConfirm={handleConfirm}
                        loading={loadingId}
                      />
                    )}
                    {item.type === 'auto_detected' && (
                      <AutoDetectedActions
                        item={item}
                        onQuickAdd={onQuickAdd}
                        onConfirm={handleConfirm}
                        loading={loadingId}
                      />
                    )}
                    {/* status_change is informational only -- no actions */}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {sortedItems.length > 0 && (
        <div className="border-t px-4 py-2">
          <p className="text-muted-foreground/60 text-center text-[10px]">
            Showing {sortedItems.length} of {items.length} items
          </p>
        </div>
      )}
    </div>
  );
}
