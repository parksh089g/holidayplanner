/** M2에서 실제 화면으로 바꿀 자리 표시 */
export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">{description}</p>
    </section>
  );
}
