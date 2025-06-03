import { isObject } from '@opensumi/ide-utils';

import { IMCPToolResult, IMCPToolResultContent } from './types';

export interface ImageCompressionOptions {
  maxSizeKB?: number;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  mimeType?: string;
}

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxSizeKB: 500, // 500KB
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1080,
  mimeType: 'image/jpeg',
};

/**
 * 获取 base64 图像的大小（KB）
 */
export function getBase64ImageSize(base64String: string): number {
  if (!base64String) {
    return 0;
  }

  // 移除 data URL 前缀
  const base64Data = base64String.split(',')[1] || base64String;

  // Base64 编码后的大小约为原始大小的 4/3
  const sizeInBytes = (base64Data.length * 3) / 4;
  return sizeInBytes / 1024; // 转换为 KB
}

/**
 * 使用 Canvas API 进行真正的图像压缩
 */
export function compressBase64Image(base64String: string, options: ImageCompressionOptions = {}): Promise<string> {
  return new Promise((resolve) => {
    try {
      // 输入验证
      if (!base64String || typeof base64String !== 'string') {
        resolve(base64String || '');
        return;
      }
      if (!base64String.startsWith('data:') && options.mimeType) {
        base64String = `data:${options.mimeType};base64,${base64String}`;
      }
      const opts = { ...DEFAULT_OPTIONS, ...options };
      const currentSize = getBase64ImageSize(base64String);
      // 如果图像已经小于目标大小，直接返回
      if (currentSize <= opts.maxSizeKB) {
        resolve(base64String);
        return;
      }
      // 创建图像对象
      const img = new Image();
      img.onload = () => {
        try {
          // 计算新的尺寸，保持宽高比
          let { width, height } = img;
          // 处理极小图片
          if (width <= 1 || height <= 1) {
            resolve(base64String);
            return;
          }
          const aspectRatio = width / height;
          if (width > opts.maxWidth) {
            width = opts.maxWidth;
            height = width / aspectRatio;
          }
          if (height > opts.maxHeight) {
            height = opts.maxHeight;
            width = height * aspectRatio;
          }
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64String);
            return;
          }
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          let compressedBase64 = canvas.toDataURL(opts.mimeType, opts.quality);
          let compressedSize = getBase64ImageSize(compressedBase64);
          let currentQuality = opts.quality;
          let attempts = 0;
          const maxAttempts = 5;
          while (compressedSize > opts.maxSizeKB && attempts < maxAttempts) {
            currentQuality *= 0.6;
            compressedBase64 = canvas.toDataURL(opts.mimeType, currentQuality);
            compressedSize = getBase64ImageSize(compressedBase64);
            attempts++;
          }
          const [, base64] = compressedBase64.split(',');
          resolve(base64);
        } catch (error) {
          // 压缩失败，返回原始图像
          resolve(base64String);
        }
      };
      img.onerror = () => {
        // 图像加载失败，返回原始字符串
        resolve(base64String);
      };
      img.src = base64String;
    } catch (error) {
      resolve(base64String);
    }
  });
}

/**
 * 压缩内容数组格式的工具结果
 */
export async function compressContentArrayResult(
  result: IMCPToolResult,
  options: ImageCompressionOptions = {},
): Promise<IMCPToolResult> {
  if (!result || !result.content || !Array.isArray(result.content)) {
    return result;
  }

  const compressedContent = await Promise.all(
    result.content.map(async (item) => {
      if (item.type === 'image') {
        let compressedData: string;
        // 检测环境
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          compressedData = await compressBase64Image(item.data, {
            ...options,
            mimeType: item.mimeType,
          });
        } else {
          compressedData = item.data;
        }

        return {
          ...item,
          data: compressedData,
        };
      }
      return item;
    }),
  );

  return {
    ...result,
    content: compressedContent,
  };
}

/**
 * 智能压缩工具结果，支持多种格式
 */
export async function compressToolResultSmart(
  result: IMCPToolResult,
  options: ImageCompressionOptions = {},
): Promise<any> {
  if (
    result &&
    isObject(result) &&
    result.content &&
    Array.isArray(result.content) &&
    result.content.some((item: IMCPToolResultContent) => item.type === 'image')
  ) {
    return await compressContentArrayResult(result, options);
  }

  return result;
}
