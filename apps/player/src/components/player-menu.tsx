"use client";

import { motion } from "framer-motion";
import { UserPlus, UserCheck, MessageSquare } from "lucide-react";
import type { TableSpot } from "@live-dealr/environments";

export function PlayerMenu({
  name,
  spot,
  isFriend,
  onFriend,
  onClose,
  onMessage,
}: {
  name: string;
  spot: TableSpot;
  isFriend: boolean;
  onFriend: () => void;
  onClose: () => void;
  onMessage?: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[45] bg-black/25"
        aria-label="Close"
        onClick={onClose}
      />
      <motion.div
        className="absolute z-[46] w-44 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/12 bg-[#121218]/96 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        style={{
          left: `${spot.x}%`,
          top: `${Math.max(10, spot.y - 18)}%`,
        }}
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/8 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="text-[10px] text-white/40">At the table</p>
        </div>
        <div className="flex flex-col p-1.5">
          <button
            type="button"
            onClick={() => {
              onFriend();
              onClose();
            }}
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-white/90 hover:bg-white/8"
          >
            {isFriend ? (
              <UserCheck className="size-4 text-[#2fbf6a]" />
            ) : (
              <UserPlus className="size-4 text-[#f0c43a]" />
            )}
            {isFriend ? "Friends" : "Add friend"}
          </button>
          {onMessage ? (
            <button
              type="button"
              onClick={() => {
                onMessage();
                onClose();
              }}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-white/90 hover:bg-white/8"
            >
              <MessageSquare className="size-4 text-white/60" />
              Message
            </button>
          ) : null}
        </div>
      </motion.div>
    </>
  );
}
