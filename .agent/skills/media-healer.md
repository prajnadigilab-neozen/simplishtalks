Skill Name: Media Permission Auto-Healer
Trigger: When a Playwright test fails due to MediaStream or NotAllowedError.

Instructions:

1. Identify the State: 
   - Check if the component (e.g., `VoiceCoach.tsx`) handles `DOMException` when `getUserMedia` is rejected.
   - Verify `isInitializing` or equivalent state is reset to `false` in `catch`/`finally` blocks to prevent the "Loading" state from hanging.

2. Analyze the UI Lifecycle: 
   - Verify if there is a `useEffect` cleanup function to stop the microphone tracks when the user navigates away or unmounts.

3. Propose Fix: 
   - Wrap the low-level `startMic` or `getUserMedia` call in a `try/catch`.
   - **Bilingual Toast Pattern (English/Kannada)**: 
     ```typescript
     toast.error(<>
       <p>Microphone access required to practice.</p>
       <p className="text-sm opacity-90 border-t border-white/20 pt-1 mt-1 font-kannada leading-relaxed">
         ಮಾತನಾಡಲು ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶ ಅಗತ್ಯವಿದೆ. ದಯವಿಟ್ಟು ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಇದನ್ನು ಸರಿಪಡಿಸಿ.
       </p>
     </>);
     ```

4. Automation Strategy:
   - Use the **Master Playwright Test Script** pattern to verify Grant (`permissions: ['microphone']`) vs Deny (`permissions: []`) scenarios.
   - Verify the "Voi (Icon)" or "Waveform" indicator appears on Grant.

5. Recovery Check:
   - Ensure the "Start Speaking" button resets from a "Loading" state back to its "Initial" state so the user can re-trigger the permission request.

Apply: Offer to apply the diff directly to the source file.