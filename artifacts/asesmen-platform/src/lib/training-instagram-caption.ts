type CaptionFields = {
  title: string; summary: string; location: string;
  startsAt: string; endsAt: string; registrationDeadline: string;
};

// The editor already uses Jakarta local datetime strings. Keep this wording
// in sync with training_instagram_caption() and its database integration test.
export function trainingInstagramCaption(form: CaptionFields) {
  const date = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]} WIB` : '';
  };
  return [
    form.title.trim(), form.summary.trim(),
    form.startsAt && `Mulai: ${date(form.startsAt)}`,
    form.endsAt && `Selesai: ${date(form.endsAt)}`,
    form.location.trim() && `Lokasi/media: ${form.location.trim()}`,
    form.registrationDeadline && `Batas pendaftaran: ${date(form.registrationDeadline)}`,
    'Informasi dan pendaftaran: kunjungi halaman Pelatihan di website Pelangi Indonesia.',
  ].filter(Boolean).join('\n\n');
}
