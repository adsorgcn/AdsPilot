import '../src/styles/design-tokens.css';
import '../src/styles/animations.css';
import '../src/app/globals.css';
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    layout: 'centered',
  },
};

export default preview;
