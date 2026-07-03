'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  WindowIcon,
  BellIcon,
  ArrowRightIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

export default function UIShowcaseDemos() {
  return (
    <div className="space-y-8">
      {/* Button Demos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <h3 className="text-lg font-semibold mb-4">按钮组件</h3>
        <div className="space-y-4">
          <button className="btn btn-primary">主要按钮</button>
          <button className="btn btn-secondary">次要按钮</button>
          <button className="btn btn-outline">边框按钮</button>
        </div>
      </motion.div>

      {/* Form Demos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6"
      >
        <h3 className="text-lg font-semibold mb-4">表单组件</h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="输入框示例"
            className="w-full px-4 py-2 border rounded-md"
          />
          <textarea
            placeholder="文本域示例"
            className="w-full px-4 py-2 border rounded-md h-24"
          />
        </div>
      </motion.div>

      {/* Loading Demos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-6"
      >
        <h3 className="text-lg font-semibold mb-4">加载状态</h3>
        <div className="space-y-4">
          <div className="animate-pulse h-4 w-full bg-gray-200 rounded"></div>
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      </motion.div>

      {/* Notification Demos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-6"
      >
        <h3 className="text-lg font-semibold mb-4">通知组件</h3>
        <div className="flex items-center space-x-2">
          <BellIcon className="h-5 w-5 text-yellow-500" />
          <span>通��消息示例</span>
          <ArrowRightIcon className="h-4 w-4" />
        </div>
      </motion.div>
    </div>
  );
}