// When this integration switches to the new SDK, simply change the import source for the following imports
import {
  setupRecording,
  Recording,
  SetupRecordingInput,
  RecordingEntry,
} from '@jupiterone/integration-sdk-testing';
import { gunzipSync } from 'zlib';

export { Recording };

export function setupOktaRecording(
  input: Omit<SetupRecordingInput, 'mutateEntry'>,
): Recording {
  return setupRecording({
    ...input,
    mutateEntry: mutateRecordingEntry,
  });
}

function mutateRecordingEntry(entry: RecordingEntry): void {
  let responseText = entry.response.content.text;
  if (!responseText) {
    return;
  }

  const contentEncoding = entry.response.headers.find(
    (e) => e.name === 'content-encoding',
  );
  const transferEncoding = entry.response.headers.find(
    (e) => e.name === 'transfer-encoding',
  );

  if (contentEncoding && contentEncoding.value === 'gzip') {
    const chunkBuffers: Buffer[] = [];
    const hexChunks = JSON.parse(responseText) as string[];
    hexChunks.forEach((chunk) => {
      const chunkBuffer = Buffer.from(chunk, 'hex');
      chunkBuffers.push(chunkBuffer);
    });

    responseText = gunzipSync(Buffer.concat(chunkBuffers)).toString('utf-8');

    // Remove encoding/chunking since content is now unzipped
    entry.response.headers = entry.response.headers.filter(
      (e) => e && e !== contentEncoding && e !== transferEncoding,
    );
    // Remove recording binary marker
    delete (entry.response.content as any)._isBinary;
    entry.response.content.text = responseText;
  }
}
