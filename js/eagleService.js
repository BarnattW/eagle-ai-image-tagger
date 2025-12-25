export async function fetchUserTags() {
  const res = await eagle.tag.get();
  return res?.map((t) => t.name) || [];
}

export async function saveTagsToItem(item, tags) {
  item.tags = item.tags.concat(tags);
  await item.save();
}
