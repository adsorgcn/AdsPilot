'use client';

import { Inter as SansFont } from 'next/font/google';
import { useServerInsertedHTML } from 'next/navigation';

const sans = SansFont({
  subsets: ['latin'],
  variable: '--font-family-sans',
  fallback: ['system-ui', 'Helvetica Neue', 'Helvetica', 'Arial'],
  preload: true,
  display: 'swap', // 防止FOIT (Flash of Invisible Text)
  weight: ['300', '400', '500', '600', '700', '800'],
  adjustFontFallback: true, // 调整fallback字体以减少布局偏移
});

// replace with your heading font
// by default, it will use the sans font
const heading = sans;

function Fonts() {
  useServerInsertedHTML(() => {
    return (
      <style
        key={'fonts'}
        dangerouslySetInnerHTML={{
          __html: `
          :root {
             --font-family-sans: '-apple-system', 'BlinkMacSystemFont',
              ${sans.style.fontFamily}, 'Segoe UI', 'Roboto', 'Ubuntu',
              'sans-serif';

            --font-family-heading: '-apple-system', 'BlinkMacSystemFont',
              ${heading.style.fontFamily};
          }
        `,
        }}
      />
    );
  });

  return null;
}

export default Fonts;
