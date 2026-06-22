import { incrementOtpCount } from './src/lib/db';

async function test() {
  try {
    const phone = '9980918073';
    const restaurantId = '00000000-0000-0000-0000-000000000000'; // test restaurant uuid

    console.log("trying incrementOtpCount");
    await incrementOtpCount(phone, restaurantId);
    console.log("Success!");
  } catch(e) {
    console.error("ERROR", e);
  } finally {
    process.exit(0);
  }
}

test();
