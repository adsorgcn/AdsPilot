import dynamic from 'next/dynamic';
import { Loader } from '~/core/ui/IconLoader';

// 动态导入UIShowcase组件以减少初始bundle大小
const UIShowcase = dynamic(
  () => import('./UIShowcase').then(mod => ({ default: mod.UIShowcase })),
  {
    loading: () => <Loader />,
    ssr: false
  }
);

export default UIShowcase;