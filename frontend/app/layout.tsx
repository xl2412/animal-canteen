import type { Metadata } from 'next';

import './styles.css';

export const metadata: Metadata = {
  title: '动物食堂',
  description: '智能喂食器管理控制台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
