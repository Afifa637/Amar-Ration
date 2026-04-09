import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  clearAllNotifications,
  clearReadNotifications,
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from "../services/api";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const refreshUnread = async () => {
    try {
      const data = await getNotifications({
        page: 1,
        limit: 50,
        status: "Unread",
      });
      setUnread((data.items || []).length);
    } catch {
      // ignore notification count errors in header
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getNotifications({ page: 1, limit: 10 });
      setItems(data.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshUnread();
    const timer = window.setInterval(() => {
      void refreshUnread();
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const onMarkRead = async (itemId: string) => {
    try {
      await markNotificationAsRead(itemId);
      setItems((prev) =>
        prev.map((item) =>
          item._id === itemId ? { ...item, status: "Read" } : item,
        ),
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsAsRead();
      setItems((prev) => prev.map((item) => ({ ...item, status: "Read" })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  const onDeleteOne = async (itemId: string) => {
    try {
      const item = items.find((x) => x._id === itemId);
      await deleteNotification(itemId);
      setItems((prev) => prev.filter((x) => x._id !== itemId));
      if (item?.status === "Unread") {
        setUnread((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // ignore
    }
  };

  const onClearRead = async () => {
    try {
      await clearReadNotifications();
      setItems((prev) => prev.filter((item) => item.status !== "Read"));
    } catch {
      // ignore
    }
  };

  const onClearAll = async () => {
    try {
      await clearAllNotifications();
      setItems([]);
      setUnread(0);
    } catch {
      // ignore
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative bg-white/15 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ef4444] text-[10px] leading-4 text-center font-semibold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white text-[#1f2937] border border-[#d7dde6] rounded shadow-lg z-50">
          <div className="px-3 py-2 border-b border-[#e5e7eb] flex items-center justify-between">
            <div className="text-[13px] font-semibold">নোটিফিকেশন</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onMarkAll()}
                className="text-[11px] text-[#16679c] hover:underline"
              >
                সব পঠিত
              </button>
              <button
                type="button"
                onClick={() => void onClearRead()}
                className="text-[11px] text-[#b45309] hover:underline"
              >
                Read মুছুন
              </button>
              <button
                type="button"
                onClick={() => void onClearAll()}
                className="text-[11px] text-[#b91c1c] hover:underline"
              >
                সব মুছুন
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-auto">
            {loading && (
              <div className="px-3 py-4 text-[12px] text-[#6b7280]">
                লোড হচ্ছে...
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[#6b7280]">
                নতুন নোটিফিকেশন নেই
              </div>
            )}

            {!loading &&
              items.map((item) => (
                <div
                  key={item._id}
                  className={`w-full text-left px-3 py-2 border-b border-[#f3f4f6] ${
                    item.status === "Unread"
                      ? "bg-white border-l-4 border-l-[#3b82f6]"
                      : "bg-gray-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void onMarkRead(item._id)}
                    className="w-full text-left hover:bg-[#f9fafb]"
                  >
                    <div className="text-[12px] font-semibold">
                      {item.title}
                    </div>
                    <div className="text-[12px] text-[#4b5563] mt-0.5">
                      {item.message}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] mt-1">
                      {new Date(item.createdAt).toLocaleString("bn-BD")}
                    </div>
                  </button>
                  <div className="mt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void onDeleteOne(item._id)}
                      className="text-[11px] text-[#b91c1c] hover:underline"
                    >
                      মুছুন
                    </button>
                  </div>
                </div>
              ))}
          </div>

          <div className="px-3 py-2 border-t border-[#e5e7eb] flex items-center justify-between text-[12px]">
            <button
              type="button"
              onClick={() => void onMarkAll()}
              className="text-[#16679c] hover:underline"
            >
              সব পড়া হয়েছে
            </button>
            <Link
              to="/notifications"
              className="text-[#16679c] hover:underline"
            >
              সব বিজ্ঞপ্তি দেখুন
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
