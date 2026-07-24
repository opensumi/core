import { act } from 'react-dom/test-utils';

const mockNewInstance = jest.fn();

jest.mock('rc-notification', () => {
  const React = require('react');
  class MockNotification extends React.Component {
    add = jest.fn();
    remove = jest.fn();

    render() {
      return null;
    }
  }
  (MockNotification as any).newInstance = mockNewInstance;
  return { __esModule: true, default: MockNotification };
});

import notification from '../src/notification/notification';

describe('notification', () => {
  afterEach(() => {
    act(() => notification.destroy());
    mockNewInstance.mockClear();
  });

  it('creates notification roots without the legacy ReactDOM.render entrypoint', async () => {
    await act(async () => {
      notification.info({ message: 'Task history unavailable' });
      await Promise.resolve();
    });

    expect(mockNewInstance).not.toHaveBeenCalled();
  });
});
