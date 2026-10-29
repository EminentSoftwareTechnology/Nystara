export const TOPICS = ["Science", "Technology", "Travel", "Home", "Health", "Finance", "AI", "Robotics", "Software Engineering", "Environment"] as const;

const REGIONS = [
  ["Kenya", "Amina Wanjiku Njeri Kamau Akinyi Otieno Zawadi Baraka Nyambura Kiptoo"],
  ["Japan", "Haruto Yui Sora Ren Aoi Hinata Itsuki Akari Minato Mei"],
  ["Brazil", "Beatriz Joao Camila Pedro Bruna Thiago Leticia Rafael Mariana Gustavo"],
  ["Morocco", "Youssef Salma Imane Mehdi Hajar Rachid Soukaina Anas Ibtissam Hamza"],
  ["Indonesia", "Dewi Budi Putri Agus Siti Bayu Wulan Dimas Ratna Fajar"],
  ["Mexico", "Ximena Santiago Valentina Diego Renata Emiliano Regina Gael Fernanda Iker"],
  ["Nigeria", "Chiamaka Tunde Ngozi Emeka Ifeoma Chidi Amara Femi Adaeze Obinna"],
  ["Finland", "Aino Eero Veera Onni Helmi Eetu Venla Toivo Sanni Ilmari"],
  ["Vietnam", "Linh Minh Thao Quang Huong Phuc Trang Duy Ngoc Khoa"],
  ["Argentina", "Lucia Tomas Julieta Facundo Agustina Lautaro Milagros Matias Rocio Bautista"],
  ["Egypt", "Mariam Omar Nour Mostafa Farida Karim Basma Sherif Dalia Ahmed"],
  ["South Korea", "Seojun Jisoo Minjun Haeun Jiho Seoyeon Dohyun Yerin Siwoo Nari"],
  ["Colombia", "Catalina Andres Manuela Felipe Daniela Juan Alejandra Nicolas Isabela Esteban"],
  ["New Zealand", "Aroha Nikau Moana Tane Anahera Wiremu Kiri Rawiri Manaia Hemi"],
  ["Turkey", "Elif Deniz Zeynep Emir Ece Kerem Asli Arda Defne Cem"],
  ["Ghana", "Akosua Kwame Abena Kofi Adwoa Yaw Afia Kojo Ama Kwesi"],
  ["Philippines", "Althea Miguel Angelica Paolo Mariel Enzo Cheska Carlo Ysabel Ramon"],
  ["Sweden", "Astrid Erik Freja Nils Ebba Oskar Alva Axel Maja Ludvig"],
  ["Peru", "Luz Alonso Fiorella Joaquin Marisol Rodrigo Belen Cesar Paloma Vicente"],
  ["South Africa", "Nomsa Sipho Thandi Themba Naledi Sibusiso Lerato Bongani Zanele Lwazi"],
] as const;

export const PROFILES = Array.from({ length: 200 }, (_, index) => {
  const [country, names] = REGIONS[index % REGIONS.length];
  const firstName = names.split(" ")[Math.floor(index / REGIONS.length)];
  return {
    id: `newsroom-user-${index + 1}`,
    name: firstName,
    email: `${firstName.toLowerCase()}.nystara@gmail.com`,
    username: `demo-${firstName.toLowerCase()}`,
    country,
    author: index < 100,
    topic: TOPICS[index % TOPICS.length],
  };
});

export function newsroomEnvironment(env: { DATABASE_URL?: string; NODE_ENV?: string; NEWSROOM_ENABLED?: string }) {
  const database = new URL(env.DATABASE_URL ?? "");
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error("A PostgreSQL DATABASE_URL is required");
  const hosted = env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname);
  if (hosted && env.NEWSROOM_ENABLED !== "1") throw new Error("Set NEWSROOM_ENABLED=1 to enable the production newsroom job");
  return { hosted };
}

export function seedDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error("Use a valid --date=YYYY-MM-DD UTC date");
  }
  if (value > new Date().toISOString().slice(0, 10)) throw new Error("Future seed dates are not supported");
  return value;
}

export function dailySlots(date: string) {
  const dayOffset = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
  return PROFILES.slice(0, 100).flatMap((profile, index) =>
    Array.from({ length: index % 2 === 0 ? 2 : 3 }, (_, slot) => ({
      id: `newsroom-${date}-${index + 1}-${slot + 1}`,
      profile,
      slot,
      topic: TOPICS[(index + slot + dayOffset) % TOPICS.length],
    })),
  );
}

export function londonRunDate(now: Date): string | null {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return part("hour") === "07" ? `${part("year")}-${part("month")}-${part("day")}` : null;
}
