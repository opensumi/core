import { DomListener, EventType, trackFocus } from '../../src';

describe('dom', () => {
  test('DomListener', (done) => {
    const element = document.createElement('div');
    const onFocus = jest.fn();
    const dom = new DomListener(element, EventType.FOCUS, onFocus, true);
    const event = new window.Event(EventType.FOCUS);
    element.dispatchEvent(event);
    setTimeout(() => {
      expect(onFocus).toBeCalled();
      dom.dispose();
      done();
    }, 100);
  });

  test('trackFocus', () => {
    const element = document.createElement('input');
    const track = trackFocus(element);
    expect(typeof track.onDidFocus).toBe('function');
    expect(typeof track.onDidBlur).toBe('function');
  });
});
