import fetch from 'node-fetch';

const transformedUrl = 'https://ffompmvolxnlqqqnhwhd.supabase.co/storage/v1/render/image/public/visual-content/1774775322492-h4ly0bxrrc.jpg?width=300&resize=contain';
const directUrl = 'https://ffompmvolxnlqqqnhwhd.supabase.co/storage/v1/object/public/visual-content/1774775322492-h4ly0bxrrc.jpg';

async function run() {
  try {
    const res1 = await fetch(transformedUrl);
    console.log("Transformed URL Status:", res1.status, res1.statusText);
    if (res1.status !== 200) {
      const text = await res1.text();
      console.log("Transformed URL Error Body:", text);
    }
  } catch (err) {
    console.error("Transformed URL Error:", err);
  }

  try {
    const res2 = await fetch(directUrl);
    console.log("Direct URL Status:", res2.status, res2.statusText);
  } catch (err) {
    console.error("Direct URL Error:", err);
  }
}
run();
