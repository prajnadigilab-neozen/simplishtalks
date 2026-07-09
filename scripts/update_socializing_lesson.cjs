const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load environment variables from .env.local
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const lessonId = 'dafe5df5-f8c7-4a9d-9b1d-31a06242d913';

// 2. Prepare new lesson structures matching the updated JSON specifications
const newSpeakTextContent = JSON.stringify({
  english_text_to_read: "The wedding hall is packed with happy guests, and the energy is incredible. Naveen’s family is finally seeing months of planning come to life. As the music plays loudly, old friends gather around the stage to take group photos with the lovely couple. Everyone is laughing, exchanging warm blessings, and waiting eagerly to head toward the main dining area for the grand wedding feast.",
  transcription_to_read_kannada_phonetic: "ದ ವೆಡ್ಡಿಂಗ್ ಹಾಲ್ ಇಸ್ ಪ್ಯಾಕ್ಡ್ ವಿತ್ ಹ್ಯಾಪಿ ಗೆಸ್ಟ್ಸ್, ಆಂಡ್ ದ ಎನರ್ಜಿ ಇಸ್ ಇನ್ಕ್ರೆಡಿಬಲ್. ನವೀನ್ಸ್ ಫ್ಯಾಮಿಲಿ ಇಸ್ ಫೈನಲಿ ಸೀಯಿಂಗ್ ಮಂತ್ಸ್ ಆಫ್ ಪ್ಲಾನಿಂಗ್ ಕಮ್ ಟು ಲೈಫ್. ಆಸ್ ದ ಮ್ಯೂಸಿಕ್ ಪ್ಲೇಸ್ ಲೌಡ್ಲಿ, ಓಲ್ಡ್ ಫ್ರೆಂಡ್ಸ್ ಗ್ಯಾದರ್ ಅರೌಂಡ್ ದ ಸ್ಟೇಜ್ ಟು ಟೇಕ್ ಗ್ರೂಪ್ ಫೋಟೋಸ್ ವಿತ್ ದ ಲವ್ಲಿ ಕಪಲ್. ಎವ್ರಿವನ್ ಇಸ್ ಲಾಫಿಂಗ್, ಎಕ್ಸ್ಚೇಂಜಿಂಗ್ ವಾರ್ಮ್ ಬ್ಲೆಸ್ಸಿಂಗ್ಸ್, ಆಂಡ್ ವೇಟಿಂಗ್ ಈಗರ್ಲಿ ಟು ಹೆಡ್ ಟುವರ್ಡ್ ದ ಮೇನ್ ಡೈನಿಂಗ್ ಏರಿಯಾ ಫಾರ್ ದ ಗ್ರಾಂಡ್ ವೆಡ್ಡಿಂಗ್ ಫೀಸ್ಟ್.",
  instruction: "Practice reading this 76-word paragraph aloud multiple times. Focus on your breathing, sentence pacing, and rhythmic cadence. Use the phonetic Kannada script below if you need a quick boost of confidence with the word flow!"
});

const newScenario = {
  character: {
    en: "Naveen & Family",
    kn: "ನವೀನ್ ಮತ್ತು ಕುಟುಂಬ"
  },
  objective: {
    en: "You are navigating the dining area and stage at the wedding venue. Interact with different family members through a 6-turn adaptive conversational tree to master polite requests, greeting elders, and managing choices under social expectations.",
    kn: "ಮದುವೆ ಮಂಟಪದಲ್ಲಿ ನವೀನ್ ಮತ್ತು ಕುಟುಂಬದವರ ಜೊತೆ ಮಾತನಾಡಿ. ೬-ಹಂತದ ಸಾಂದರ್ಭಿಕ ಸಂಭಾಷಣೆಯ ಮೂಲಕ ಹಿರಿಯರನ್ನು ಗೌರವಿಸುವುದು ಮತ್ತು ಸಾಮಾಜಿಕ ಸೌಜನ್ಯಗಳನ್ನು ಕಲಿಯಿರಿ."
  },
  objectiveStr: "You are navigating the dining area and stage at the wedding venue. Interact with different family members through a 6-turn adaptive conversational tree to master polite requests, greeting elders, and managing choices under social expectations.",
  initialMessage: "Hey Vikas! Thanks for making it. Look, my uncle is standing right there by the stage. Let me introduce you to him. Come over!",
  systemInstruction: "You are Naveen, his Uncle, and the Bride/Groom. Vikas is attending the wedding.",
  choice_based_roleplay: [
    {
      turn: 1,
      ai_prompt: {
        english: "Hey Vikas! Thanks for making it. Look, my uncle is standing right there by the stage. Let me introduce you to him. Come over!",
        kannada: "ಹೇ ವಿಕಾಸ್! ಬಂದಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನೋಡು, ನನ್ನ ಮಾವ ಸ್ಟೇಜ್ ಪಕ್ಕದಲ್ಲೇ ನಿಂತಿದ್ದಾರೆ. ನಿನಗೆ ಅವರನ್ನು ಪರಿಚಯಿಸುತ್ತೇನೆ. ಇಲ್ಲಿ ಬಾ!",
        transliteration: "Hey Vikas! Bandiddakkaagi dhanyavaadagalu. Nodu, nanna maava stage pakkadalle nintiddare. Nimage avarannu parichayisuttene. Illi baa!"
      },
      options: [
        {
          option_id: "1A",
          english: "Sure, lead the way! I would love to meet your uncle.",
          kannada: "ಖಂಡಿತ, ನಡೆ! ನಿಮ್ಮ ಮಾವನನ್ನು ಭೇಟಿ ಮಾಡಲು ನನಗೆ ಇಷ್ಟ.",
          feedback: "Perfect! 'Lead the way' is a highly natural idiomatic expression showing readiness."
        },
        {
          option_id: "1B",
          english: "Okay, I will come behind you.",
          kannada: "ಸರಿ, ನಾನು ನಿನ್ನ ಹಿಂದೆ ಬರುತ್ತೇನೆ.",
          feedback: "Grammatically fine, but a bit plain. Try 'Lead the way' or 'After you' to sound more natural."
        }
      ]
    },
    {
      turn: 2,
      ai_prompt: {
        english: "Hello young man! Naveen tells me you two are working on some very exciting projects together. How are you enjoying the grand celebration?",
        kannada: "ಹಲೋ ಯುವಕನೇ! ನೀವು ಇಬ್ಬರೂ ಒಟ್ಟಿಗೆ ಕೆಲವು ರೋಮಾಂಚಕಾರಿ ಪ್ರಾಜೆಕ್ಟ್ಗಳಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದೀರಿ ಎಂದು ನವೀನ್ ಹೇಳುತ್ತಿದ್ದ. ಮದುವೆ ಸಂಭ್ರಮ ಹೇಗೆ ಅನಿಸುತ್ತಿದೆ?",
        transliteration: "Hello yuvakane! Neevu ibbaroo ottige kelavu romanchakari project-galalli kelasa maaduttiddiri endu Naveen heluttidda. Maduve sambhrama hege anisuttide?"
      },
      options: [
        {
          option_id: "2A",
          english: "Namaste Uncle. It is wonderful! The atmosphere is full of life and the decorations are stunning.",
          kannada: "ನಮಸ್ತೆ ಅಂಕಲ್. ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ! ಇಲ್ಲಿನ ವಾತಾವರಣವು ಉತ್ಸಾಹದಿಂದ ಕೂಡಿದೆ ಮತ್ತು ಅಲಂಕಾರಗಳು ಅದ್ಭುತವಾಗಿವೆ.",
          feedback: "Excellent phrase choices! 'Full of life' perfectly translates the joyful wedding vibe."
        },
        {
          option_id: "2B",
          english: "Namaste. Celebration is very big and good.",
          kannada: "ನಮಸ್ತೆ. ಸಂಭ್ರಮವು ತುಂಬಾ ದೊಡ್ಡದಾಗಿದೆ ಮತ್ತು ಒಳ್ಳೆಯದಾಗಿದೆ.",
          feedback: "A bit repetitive. Use descriptive adjectives like 'wonderful', 'grand', or 'stunning' instead of just 'big and good'."
        }
      ]
    },
    {
      turn: 3,
      ai_prompt: {
        english: "Glad to hear that! Our family worked really hard on this. Have you had a chance to congratulate the bride and groom on the stage yet?",
        kannada: "ಕೇಳಿ ಸಂತೋಷವಾಯಿತು! ನಮ್ಮ ಕುಟುಂಬ ಇದಕ್ಕಾಗಿ ನಿಜವಾಗಿಯೂ ಶ್ರಮಿಸಿದೆ. ವೇದಿಕೆಯ ಮೇಲಿರುವ ವಧು-ವರರಿಗೆ ಅಭಿನಂದನೆ ಸಲ್ಲಿಸಲು ನಿಮಗೆ ಅವಕಾಶ ಸಿಕ್ಕಿತೇ?",
        transliteration: "Keli santoshavayitu! Namma kutumba idakkaagi nijavagloo shramiside. Vedikeya meliruva vadhu-vararige abhinandane sallisalu nimage avakasha sikkite?"
      },
      options: [
        {
          option_id: "3A",
          english: "Not yet, the line is quite long. I will wait a bit and go up when it clears out.",
          kannada: "ಇನ್ನೂ ಇಲ್ಲ, ಸಾಲು ತುಂಬಾ ಉದ್ದವಾಗಿದೆ. ನಾನು ಸ್ವಲ್ಪ ಕಾಯ್ದು, ಜನ ಕಡಿಮೆಯಾದಾಗ ಮೇಲೆ ಹೋಗುತ್ತೇನೆ.",
          feedback: "Wonderful. 'When it clears out' shows excellent command over conversational English phrasal verbs."
        },
        {
          option_id: "3B",
          english: "No, because too many people are standing on the stage.",
          kannada: "ಇಲ್ಲ, ಯಾಕೆಂದರೆ ಸ್ಟೇಜ್ ಮೇಲೆ ತುಂಬಾ ಜನ ನಿಂತಿದ್ದಾರೆ.",
          feedback: "Using 'because' here sounds slightly complaining. Phrasing it as 'the line is long' is more polite."
        }
      ]
    },
    {
      turn: 4,
      ai_prompt: {
        english: "Hey Vikas, look! The line just got shorter. Let's go up quickly before it gets crowded again. Do you have the gift box with you?",
        kannada: "ಹೇ ವಿಕಾಸ್, ನೋಡು! ಕ್ಯೂ ಈಗ ತಾನೇ ಚಿಕ್ಕದಾಯಿತು. ಮತ್ತೆ ಜನ ಸೇರುವ ಮುನ್ನ ಬೇಗ ಮೇಲೆ ಹೋಗೋಣ. ಗಿಫ್ಟ್ ಬಾಕ್ಸ್ ನಿನ್ನ ಬಳಿ ಇದೆಯಾ?",
        transliteration: "Hey Vikas, nodu! Queue eega taane chikkadaayitu. Matte jana seruva munna bega mele hogona. Gift box ninna bali ideya?"
      },
      options: [
        {
          option_id: "4A",
          english: "Yes, I have it right here in my hand. Let's head up.",
          kannada: "ಹೌದು, ಅದು ಇಲ್ಲೇ ನನ್ನ ಕೈಯಲ್ಲಿದೆ. ನಡಿ ಮೇಲೆ ಹೋಗೋಣ.",
          feedback: "Spot on. Direct, clear, and perfectly pairs with the quick-paced situation."
        },
        {
          option_id: "4B",
          english: "Yes, gift is with me only.",
          kannada: "ಹೌದು, ಗಿಫ್ಟ್ ನನ್ನ ಬಳಿಯೇ ಇದೆ.",
          feedback: "Avoid using 'with me only' as a literal translation of 'ನನ್ನ ಹತ್ರನೇ ಇದೆ'. Use 'right here in my hand' or 'I have it right here'."
        }
      ]
    },
    {
      turn: 5,
      ai_prompt: {
        english: "Vikas! Thank you so much for coming all the way to bless us. We really appreciate your presence!",
        kannada: "ವಿಕಾಸ್! ನಮಗೆ ಆಶೀರ್ವದಿಸಲು ಇಷ್ಟು ದೂರ ಬಂದಿದ್ದಕ್ಕಾಗಿ ತುಂಬಾ ಧನ್ಯವಾದಗಳು. ನೀವು ಬಂದಿದ್ದು ನಮಗೆ ತುಂಬಾ ಸಂತೋಷ ತಂದಿದೆ!",
        transliteration: "Vikas! Namage aasheervadisaalu ishtu doora bandiddakkaagi tumba dhanyavaadagalu. Neevu bandiddu namage tumba santoshavagide!"
      },
      options: [
        {
          option_id: "5A",
          english: "The pleasure is all mine! Wishing you both a lifetime of love, happiness, and togetherness.",
          kannada: "ನನ್ನದೂ ಅಷ್ಟೇ ಸಂತೋಷ! ನಿಮ್ಮಿಬ್ಬರಿಗೂ ಆಜೀವ ಪ್ರೀತಿ, ಸಂತೋಷ ಮತ್ತು ಒಟ್ಟಿಗೆ ಬಾಳುವ ಶುಭ ಹಾರೈಕೆಗಳು.",
          feedback: "Beautifully done. 'The pleasure is all mine' is a stellar native response to someone thanking you."
        },
        {
          option_id: "5B",
          english: "Thank you. Happy married life to both of you.",
          kannada: "ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮಿಬ್ಬರಿಗೂ ಸುಖಿ ದಾಂಪತ್ಯ ಜೀವನದ ಶುಭಾಶಯಗಳು.",
          feedback: "Good, but a little standard. Adding a warm opening phrase like 'Congratulations!' or 'The pleasure is mine!' elevates it."
        }
      ]
    },
    {
      turn: 6,
      ai_prompt: {
        english: "Alright, now that we successfully congratulated them, my stomach is growling! Shall we head over to the dinner counters?",
        kannada: "ಸರಿ, ಈಗ ಅವರಿಗೆ ಯಶಸ್ವಿಯಾಗಿ ಶುಭ ಹಾರೈಸಿಯಾಯಿತು, ನನ್ನ ಹೊಟ್ಟೆ ಚುರುಗುಟ್ಟುತ್ತಿದೆ! ಊಟದ ಕೌಂಟರ್ಗಳ ಕಡೆಗೆ ಹೋಗೋಣವೇ?",
        transliteration: "Sari, eega avarige yashasviyaagi shubha haraisiyayitu, nanna hotte churuguttuttide! Ootada counter-gala kadege hogonave?"
      },
      options: [
        {
          option_id: "6A",
          english: "Lead the way! I have been smelling that delicious traditional catering since I arrived.",
          kannada: "ನಡೆ ಮುಂದೆ! ನಾನು ಬಂದಾಗಿನಿಂದಲೂ ಆ ರುಚಿಕರವಾದ ಸಾಂಪ್ರದಾಯಿಕ ಅಡುಗೆಯ ವಾಸನೆ ಬರುತ್ತಿದೆ.",
          feedback: "Fantastic! This wraps up the conversation loop smoothly while using terms practiced in the study section."
        },
        {
          option_id: "6B",
          english: "Yes, I am also very hungry. Let's eat food.",
          kannada: "ಹೌದು, ನನಗೂ ತುಂಬಾ ಹಸಿಯುತ್ತಿದೆ. ನಡೆ ಊಟ ಮಾಡೋಣ.",
          feedback: "Simple and correct, though adding a descriptive mention of the food or catering makes the sentence flow much better socially."
        }
      ]
    }
  ]
};

const newTextContent = `Naveen (Your Friend): Hey Vikas! Thanks for making it. Look, my uncle is standing right there by the stage. Let me introduce you to him. Come over! | ಹೇ ವಿಕಾಸ್! ಬಂದಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನೋಡು, ನನ್ನ ಮಾವ ಸ್ಟೇಜ್ ಪಕ್ಕದಲ್ಲೇ ನಿಂತಿದ್ದಾರೆ. ನಿನಗೆ ಅವರನ್ನು ಪರಿಚಯಿಸುತ್ತೇನೆ. ಇಲ್ಲಿ ಬಾ!
Vikas: Sure, lead the way! I would love to meet your uncle. | ಖಂಡಿತ, ನಡೆ! ನಿಮ್ಮ ಮಾವನನ್ನು ಭೇಟಿ ಮಾಡಲು ನನಗೆ ಇಷ್ಟ.
Naveen's Uncle: Hello young man! Naveen tells me you two are working on some very exciting projects together. How are you enjoying the grand celebration? | ಹಲೋ ಯುವಕನೇ! ನೀವು ಇಬ್ಬರೂ ಒಟ್ಟಿಗೆ ಕೆಲವು ರೋಮಾಂಚಕಾರಿ ಪ್ರಾಜೆಕ್ಟ್ಗಳಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದೀರಿ ಎಂದು ನವೀನ್ ಹೇಳುತ್ತಿದ್ದ. ಮದುವೆ ಸಂಭ್ರಮ ಹೇಗೆ ಅನಿಸುತ್ತಿದೆ?
Vikas: Namaste Uncle. It is wonderful! The atmosphere is full of life and the decorations are stunning. | ನಮಸ್ತೆ ಅಂಕಲ್. ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ! ಇಲ್ಲಿನ ವಾತಾವರಣವು ಉತ್ಸಾಹದಿಂದ ಕೂಡಿದೆ ಮತ್ತು ಅಲಂಕಾರಗಳು ಅದ್ಭುತವಾಗಿವೆ.
Naveen's Uncle: Glad to hear that! Our family worked really hard on this. Have you had a chance to congratulate the bride and groom on the stage yet? | ಕೇಳಿ ಸಂತೋಷವಾಯಿತು! ನಮ್ಮ ಕುಟುಂಬ ಇದಕ್ಕಾಗಿ ನಿಜವಾಗಿಯೂ ಶ್ರಮಿಸಿದೆ. ವೇದಿಕೆಯ ಮೇಲಿರುವ ವಧು-ವರರಿಗೆ ಅಭಿನಂದನೆ ಸಲ್ಲಿಸಲು ನಿಮಗೆ ಅವಕಾಶ ಸಿಕ್ಕಿತೇ?
Vikas: Not yet, the line is quite long. I will wait a bit and go up when it clears out. | ಇನ್ನೂ ಇಲ್ಲ, ಸಾಲು ತುಂಬಾ ಉದ್ದವಾಗಿದೆ. ನಾನು ಸ್ವಲ್ಪ ಕಾಯ್ದು, ಜನ ಕಡಿಮೆಯಾದಾಗ ಮೇಲೆ ಹೋಗುತ್ತೇನೆ.
Naveen: Hey Vikas, look! The line just got shorter. Let's go up quickly before it gets crowded again. Do you have the gift box with you? | ಹೇ ವಿಕಾಸ್, ನೋಡು! ಕ್ಯೂ ಈಗ ತಾನೇ ಚಿಕ್ಕದಾಯಿತು. ಮತ್ತೆ ಜನ ಸೇರುವ ಮುನ್ನ ಬೇಗ ಮೇಲೆ ಹೋಗೋಣ. ಗಿಫ್ಟ್ ಬಾಕ್ಸ್ ನಿನ್ನ ಬಳಿ ಇದೆಯಾ?
Vikas: Yes, I have it right here in my hand. Let's head up. | ಹೌದು, ಅದು ಇಲ್ಲೇ ನನ್ನ ಕೈಯಲ್ಲಿದೆ. ನಡಿ ಮೇಲೆ ಹೋಗೋಣ.
The Bride & Groom: Vikas! Thank you so much for coming all the way to bless us. We really appreciate your presence! | ವಿಕಾಸ್! ನಮಗೆ ಆಶೀರ್ವದಿಸಲು ಇಷ್ಟು ದೂರ ಬಂದಿದ್ದಕ್ಕಾಗಿ ತುಂಬಾ ಧನ್ಯವಾದಗಳು. ನೀವು ಬಂದಿದ್ದು ನಮಗೆ ತುಂಬಾ ಸಂತೋಷ ತಂದಿದೆ!
Vikas: The pleasure is all mine! Wishing you both a lifetime of love, happiness, and togetherness. | ನನ್ನದೂ ಅಷ್ಟೇ ಸಂತೋಷ! ನಿಮ್ಮಿಬ್ಬರಿಗೂ ಆಜೀವ ಪ್ರೀತಿ, ಸಂತೋಷ ಮತ್ತು ಒಟ್ಟಿಗೆ ಬಾಳುವ ಶುಭ ಹಾರೈಕೆಗಳು.
Naveen: Alright, now that we successfully congratulated them, my stomach is growling! Shall we head over to the dinner counters? | ಸರಿ, ಈಗ ಅವರಿಗೆ ಯಶಸ್ವಿಯಾಗಿ ಶುಭ ಹಾರೈಸಿಯಾಯಿತು, ನನ್ನ ಹೊಟ್ಟೆ ಚುರುಗುಟ್ಟುತ್ತಿದೆ! ಊಟದ ಕೌಂಟರ್ಗಳ ಕಡೆಗೆ ಹೋಗೋಣವೇ?
Vikas: Lead the way! I have been smelling that delicious traditional catering since I arrived. | ನಡೆ ಮುಂದೆ! ನಾನು ಬಂದಾಗಿನಿಂದಲೂ ಆ ರುಚಿಕರವಾದ ಸಾಂಪ್ರದಾಯಿಕ ಅಡುಗೆಯ ವಾಸನೆ ಬರುತ್ತಿದೆ.`;

const newStudyTextContent = `🌟 CULTURAL & IDIOMATIC CONTEXT:
In Indian social contexts, especially weddings, small talk moves very fast from introductions to hospitality. While a Kannada speaker might say 'ಬಂದಿದ್ದಕ್ಕೆ ತುಂಬಾ ಸಂತೋಷ' (Bandiddakke tumba santosha), the English equivalent uses warm hospitality phrases like 'Thank you for having me' or 'It's an honor to be here'. When talking about the grand arrangements or crowd at a wedding, native English speakers often use the idiom 'the more, the merrier' (ಹೆಚ್ಚು ಜನರಿದ್ದಷ್ಟೂ ಹೆಚ್ಚು ಮಜಾ). Another highly common phrase is 'tie the knot' which simply means to get married. Instead of saying 'My friend is getting married today', using 'My friend is tying the knot today' makes your English sound incredibly natural and fluid.

🌟 KANNADA BRIDGE:
In Kannada culture, we ask 'ಊಟ ಹೇಗಿತ್ತು?' to show care. In English, when complimenting the food layout or catering arrangement, we say 'The spread looks amazing!' or 'You have quite a spread here!'. 'Spread' refers to a large, beautiful display of different food items. Avoid translating word-for-word like 'Food items are sitting nicely'.

📚 KEY VOCABULARY:
- Hospitality: The friendly and generous reception and entertainment of guests.
  Kannada Equivalent: ಆತಿಥ್ಯ (Aatithya)
  Example: "Thank you for your wonderful hospitality tonight, Aunty."
- Festivities: The events and celebrations surrounding a special occasion.
  Kannada Equivalent: ಸಂಭ್ರಮಾಚರಣೆಗಳು (Sambhramaacharanegalu)
  Example: "I am so glad to be a part of these wedding festivities."
- Catering: The provision of food and drink at a social event or gathering.
  Kannada Equivalent: ಅಡುಗೆ ಮತ್ತು ಊಟದ ವ್ಯವಸ್ಥೆ (Aduge mattu ootada vyavasthe)
  Example: "The catering at this venue is absolutely exceptional."`;

async function main() {
  // 1. Update local db_lessons.json
  const dbPath = path.join(__dirname, '../db_lessons.json');
  const lessons = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const idx = lessons.findIndex(l => l.id === lessonId);
  if (idx === -1) {
    console.error("Lesson not found in local db_lessons.json!");
    return;
  }

  lessons[idx].speak_text_content = newSpeakTextContent;
  lessons[idx].english_text_to_read = "The wedding hall is packed with happy guests, and the energy is incredible. Naveen’s family is finally seeing months of planning come to life. As the music plays loudly, old friends gather around the stage to take group photos with the lovely couple. Everyone is laughing, exchanging warm blessings, and waiting eagerly to head toward the main dining area for the grand wedding feast.";
  lessons[idx].transcription_to_read_kannada_phonetic = "ದ ವೆಡ್ಡಿಂಗ್ ಹಾಲ್ ಇಸ್ ಪ್ಯಾಕ್ಡ್ ವಿತ್ ಹ್ಯಾಪಿ ಗೆಸ್ಟ್ಸ್, ಆಂಡ್ ದ ಎನರ್ಜಿ ಇಸ್ ಇನ್ಕ್ರೆಡಿಬಲ್. ನವೀನ್ಸ್ ಫ್ಯಾಮಿಲಿ ಇಸ್ ಫೈನಲಿ ಸೀಯಿಂಗ್ ಮಂತ್ಸ್ ಆಫ್ ಪ್ಲಾನಿಂಗ್ ಕಮ್ ಟು ಲೈಫ್. ಆಸ್ ದ ಮ್ಯೂಸಿಕ್ ಪ್ಲೇಸ್ ಲೌಡ್ಲಿ, ಓಲ್ಡ್ ಫ್ರೆಂಡ್ಸ್ ಗ್ಯಾದರ್ ಅರೌಂಡ್ ದ ಸ್ಟೇಜ್ ಟು ಟೇಕ್ ಗ್ರೂಪ್ ಫೋಟೋಸ್ ವಿತ್ ದ ಲವ್ಲಿ ಕಪಲ್. ಎವ್ರಿವನ್ ಇಸ್ ಲಾಫಿಂಗ್, ಎಕ್ಸ್ಚೇಂಜಿಂಗ್ ವಾರ್ಮ್ ಬ್ಲೆಸ್ಸಿಂಗ್ಸ್, ಆಂಡ್ ವೇಟಿಂಗ್ ಈಗರ್ಲಿ ಟು ಹೆಡ್ ಟುವರ್ಡ್ ದ ಮೇನ್ ಡೈನಿಂಗ್ ಏರಿಯಾ ಫಾರ್ ದ ಗ್ರಾಂಡ್ ವೆಡ್ಡಿಂಗ್ ಫೀಸ್ಟ್.";
  lessons[idx].transcription_to_read_transliteration = "";
  lessons[idx].scenario = newScenario;
  lessons[idx].text_content = newTextContent;
  lessons[idx].study_text_content = newStudyTextContent;

  fs.writeFileSync(dbPath, JSON.stringify(lessons, null, 2), 'utf8');
  console.log("✅ Updated db_lessons.json locally with new wedding json format.");

  // 2. Log in as Super Admin
  console.log("🔑 Authenticating with Supabase as Super Admin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    phone: '9999900001',
    password: 'AdminPass123'
  });

  if (authError) {
    console.log("❌ Admin auth failed, attempting anonymized update...");
  } else {
    console.log("🔓 Authenticated as Admin successfully.");
  }

  // 3. Update Remote Supabase DB
  console.log("⬆️ Syncing changes to Supabase 'lessons' table...");
  const { data: updateData, error: updateError } = await supabase
    .from('lessons')
    .update({
      speak_text_content: newSpeakTextContent,
      english_text_to_read: "The wedding hall is packed with happy guests, and the energy is incredible. Naveen’s family is finally seeing months of planning come to life. As the music plays loudly, old friends gather around the stage to take group photos with the lovely couple. Everyone is laughing, exchanging warm blessings, and waiting eagerly to head toward the main dining area for the grand wedding feast.",
      transcription_to_read_kannada_phonetic: "ದ ವೆಡ್ಡಿಂಗ್ ಹಾಲ್ ಇಸ್ ಪ್ಯಾಕ್ಡ್ ವಿತ್ ಹ್ಯಾಪಿ ಗೆಸ್ಟ್ಸ್, ಆಂಡ್ ದ ಎನರ್ಜಿ ಇಸ್ ಇನ್ಕ್ರೆಡಿಬಲ್. ನವೀನ್ಸ್ ಫ್ಯಾಮಿಲಿ ಇಸ್ ಫೈನಲಿ ಸೀಯಿಂಗ್ ಮಂತ್ಸ್ ಆಫ್ ಪ್ಲಾನಿಂಗ್ ಕಮ್ ಟು ಲೈಫ್. ಆಸ್ ದ ಮ್ಯೂಸಿಕ್ ಪ್ಲೇಸ್ ಲೌಡ್ಲಿ, ಓಲ್ಡ್ ಫ್ರೆಂಡ್ಸ್ ಗ್ಯಾದರ್ ಅರೌಂಡ್ ದ ಸ್ಟೇಜ್ ಟು ಟೇಕ್ ಗ್ರೂಪ್ ಫೋಟೋಸ್ ವಿತ್ ದ ಲವ್ಲಿ ಕಪಲ್. ಎವ್ರಿವನ್ ಇಸ್ ಲಾಫಿಂಗ್, ಎಕ್ಸ್ಚೇಂಜಿಂಗ್ ವಾರ್ಮ್ ಬ್ಲೆಸ್ಸಿಂಗ್ಸ್, ಆಂಡ್ ವೇಟಿಂಗ್ ಈಗರ್ಲಿ ಟು ಹೆಡ್ ಟುವರ್ಡ್ ದ ಮೇನ್ ಡೈನಿಂಗ್ ಏರಿಯಾ ಫಾರ್ ದ ಗ್ರಾಂಡ್ ವೆಡ್ಡಿಂಗ್ ಫೀಸ್ಟ್.",
      transcription_to_read_transliteration: null,
      scenario: newScenario,
      text_content: newTextContent,
      study_text_content: newStudyTextContent
    })
    .eq('id', lessonId);

  if (updateError) {
    if (updateError.code === 'PGRST204' || (updateError.message && updateError.message.includes('column'))) {
      console.log("⚠️ Schema cache indicates columns don't exist yet on remote table. Falling back to serializing guides in speak_text_content...");
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('lessons')
        .update({
          speak_text_content: newSpeakTextContent,
          scenario: newScenario,
          text_content: newTextContent,
          study_text_content: newStudyTextContent
        })
        .eq('id', lessonId);
      
      if (fallbackError) {
        console.error("❌ Fallback sync also failed:", fallbackError);
      } else {
        console.log("✅ Synced successfully to Supabase with fallback!");
      }
    } else {
      console.error("❌ Supabase sync failed:", updateError);
    }
  } else {
    console.log("✅ Synced successfully to Supabase 'lessons' table using structured columns!");
  }
}

main();
