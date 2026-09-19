#import <Foundation/Foundation.h>
#import <dlfcn.h>
#import <string.h>

#import "HotswapImage.h"
#import "HotswapRebind.h"

namespace {

size_t rebindSection(const section_64 *section,
                     const HotswapImage &image,
                     const HotswapSymbols &table,
                     void *replacementImage,
                     const void *replacementBase) {
  auto **slots = (void **)(image.slide + section->addr);
  const uint32_t *indirect = table.indirect + section->reserved1;
  const size_t count = section->size / sizeof(void *);
  size_t rebound = 0;

  if (!HotswapMakeWritable(slots, section->size)) return 0;

  for (size_t i = 0; i < count; i++) {
    const uint32_t index = indirect[i];
    if (index == INDIRECT_SYMBOL_ABS || index == INDIRECT_SYMBOL_LOCAL) continue;

    const char *name = table.strings + table.entries[index].n_un.n_strx;
    if (name == nullptr || name[0] != '_') continue;

    void *replacement = dlsym(replacementImage, name + 1);
    if (replacement == nullptr || replacement == slots[i]) continue;

    Dl_info info{};
    if (dladdr(replacement, &info) == 0 || info.dli_fbase != replacementBase) continue;

    slots[i] = replacement;
    rebound++;
  }

  return rebound;
}

}  // namespace

size_t HotswapRebindSymbols(void *replacementImage, const char *path) {
  HotswapImage replacement{};
  if (!HotswapFindImage(path, replacement)) return 0;

  __block size_t rebound = 0;

  HotswapEachAppImage(replacement.header, ^(const HotswapImage &image) {
    HotswapSymbols table{};
    if (!HotswapReadSymbols(image, table) || table.indirect == nullptr) return;

    HotswapEachDataSection(image, ^(const section_64 *section) {
      const uint32_t type = section->flags & SECTION_TYPE;
      if (type != S_LAZY_SYMBOL_POINTERS && type != S_NON_LAZY_SYMBOL_POINTERS) return;

      rebound += rebindSection(section, image, table, replacementImage, replacement.header);
    });
  });

  return rebound;
}

bool HotswapHasReplacements(const char *path) {
  HotswapImage image{};
  if (!HotswapFindImage(path, image)) return false;

  auto *command = (const load_command *)((uintptr_t)image.header + sizeof(mach_header_64));

  for (uint32_t i = 0; i < image.header->ncmds; i++) {
    if (command->cmd == LC_SEGMENT_64) {
      auto *segment = (const segment_command_64 *)command;
      auto *section = (const section_64 *)((uintptr_t)segment + sizeof(segment_command_64));

      for (uint32_t j = 0; j < segment->nsects; j++, section++) {
        if (strncmp(section->sectname, "__swift5_replace", sizeof(section->sectname)) == 0) {
          return true;
        }

        if (strncmp(section->sectname, "__objc_catlist", sizeof(section->sectname)) == 0) {
          return true;
        }
      }
    }

    command = (const load_command *)((uintptr_t)command + command->cmdsize);
  }

  return false;
}
