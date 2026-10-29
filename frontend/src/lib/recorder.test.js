import { describe, expect, it } from 'vitest';
import { canRecord, recorderErrorCode } from '@/lib/recorder';

describe('canRecord', () => {
  it('pide MediaRecorder y acceso al micrófono', () => {
    const navigator = { mediaDevices: { getUserMedia: () => {} } };
    expect(canRecord({ MediaRecorder: function MediaRecorder() {}, navigator })).toBe(true);
    expect(canRecord({ navigator })).toBe(false);
    expect(canRecord({ MediaRecorder: function MediaRecorder() {}, navigator: {} })).toBe(false);
  });
});

describe('recorderErrorCode', () => {
  it('agrupa los errores del micrófono en casos que se le pueden explicar al usuario', () => {
    expect(recorderErrorCode({ name: 'NotAllowedError' })).toBe('denied');
    expect(recorderErrorCode({ name: 'SecurityError' })).toBe('denied');
    expect(recorderErrorCode({ name: 'NotFoundError' })).toBe('no-mic');
    expect(recorderErrorCode({ name: 'AbortError' })).toBe('unavailable');
    expect(recorderErrorCode(undefined)).toBe('unavailable');
  });
});
