#import <Foundation/Foundation.h>
#import <dlfcn.h>
#import <mach-o/dyld.h>
#import <mach-o/loader.h>
#import <mach-o/nlist.h>
#import <sys/mman.h>
#import <limits.h>
#import <stdlib.h>
#import <unistd.h>

#import "HotswapRebind.h"

namespace {

struct Replacement {
  void *handle;
  const void *base;
};

struct SymbolTable {
  const nlist_64 *symbols;
  const char *strings;
  const uint32_t *indirect;
};

bool readSymbolTable(const mach_header_64 *header, intptr_t slide, SymbolTable &into) {
  const symtab_command *symtab = nullptr;
  const dysymtab_command *dysymtab = nullptr;
  intptr_t linkedit = 0;

  auto *command = (const load_command *)((uintptr_t)header + sizeof(mach_header_64));

  for (uint32_t i = 0; i < header->ncmds; i++) {
    if (command->cmd == LC_SEGMENT_64) {
      auto *segment = (const segment_command_64 *)command;
      if (strcmp(segment->segname, SEG_LINKEDIT) == 0) {
        linkedit = slide + segment->vmaddr - segment->fileoff;
      }
    } else if (command->cmd == LC_SYMTAB) {
      symtab = (const symtab_command *)command;
    } else if (command->cmd == LC_DYSYMTAB) {
      dysymtab = (const dysymtab_command *)command;
    }

    command = (const load_command *)((uintptr_t)command + command->cmdsize);
  }

  if (symtab == nullptr || dysymtab == nullptr || linkedit == 0) return false;

  into.symbols = (const nlist_64 *)(linkedit + symtab->symoff);
  into.strings = (const char *)(linkedit + symtab->stroff);
  into.indirect = (const uint32_t *)(linkedit + dysymtab->indirectsymoff);

  return true;
}

bool makeWritable(void *address, size_t size) {
  const size_t page = (size_t)getpagesize();
  auto start = (uintptr_t)address & ~(page - 1);
  const size_t span = ((uintptr_t)address + size) - start;

  return mprotect((void *)start, span, PROT_READ | PROT_WRITE) == 0;
}

/** Points every slot naming a symbol the new image exports at the new implementation. */
size_t rebindSection(const section_64 *section,
                     intptr_t slide,
                     const SymbolTable &table,
                     const Replacement &replacement_) {
  void *replacementImage = replacement_.handle;
  const void *replacementBase = replacement_.base;
  auto **slots = (void **)(slide + section->addr);
  const uint32_t *indirect = table.indirect + section->reserved1;
  const size_t count = section->size / sizeof(void *);
  size_t rebound = 0;

  // __DATA_CONST is read-only once dyld has applied its fixups, so writing a slot without
  // lifting the protection first takes the whole app down.
  if (!makeWritable(slots, section->size)) return 0;

  for (size_t i = 0; i < count; i++) {
    const uint32_t index = indirect[i];
    if (index == INDIRECT_SYMBOL_ABS || index == INDIRECT_SYMBOL_LOCAL) continue;

    const char *name = table.strings + table.symbols[index].n_un.n_strx;
    if (name == nullptr || name[0] != '_') continue;

    void *replacement = dlsym(replacementImage, name + 1);
    if (replacement == nullptr || replacement == slots[i]) continue;

    // dlsym walks the handle's dependencies too, so a hit may live in Foundation or the
    // Swift runtime. Only an address inside the new image is a replacement.
    Dl_info info{};
    if (dladdr(replacement, &info) == 0 || info.dli_fbase != replacementBase) continue;

    slots[i] = replacement;
    rebound++;
  }

  return rebound;
}

size_t rebindImage(const mach_header_64 *header, intptr_t slide, const Replacement &replacement) {
  SymbolTable table{};
  if (!readSymbolTable(header, slide, table)) return 0;

  size_t rebound = 0;
  auto *command = (const load_command *)((uintptr_t)header + sizeof(mach_header_64));

  for (uint32_t i = 0; i < header->ncmds; i++) {
    if (command->cmd == LC_SEGMENT_64) {
      auto *segment = (const segment_command_64 *)command;

      if (strcmp(segment->segname, SEG_DATA) == 0 ||
          strcmp(segment->segname, "__DATA_CONST") == 0) {
        auto *section = (const section_64 *)((uintptr_t)segment + sizeof(segment_command_64));

        for (uint32_t j = 0; j < segment->nsects; j++, section++) {
          const uint32_t type = section->flags & SECTION_TYPE;
          if (type != S_LAZY_SYMBOL_POINTERS && type != S_NON_LAZY_SYMBOL_POINTERS) continue;

          rebound += rebindSection(section, slide, table, replacement);
        }
      }
    }

    command = (const load_command *)((uintptr_t)command + command->cmdsize);
  }

  return rebound;
}

}  // namespace

size_t HotswapRebindSymbols(void *replacementImage, const char *path) {
  const void *base = HotswapImageBase(path);
  if (base == nullptr) return 0;

  const Replacement replacement{replacementImage, base};

  size_t rebound = 0;
  NSString *bundle = NSBundle.mainBundle.bundlePath;

  for (uint32_t i = 0; i < _dyld_image_count(); i++) {
    auto *header = (const mach_header_64 *)_dyld_get_image_header(i);
    if (header == nullptr || header->magic != MH_MAGIC_64) continue;
    if (header->filetype != MH_EXECUTE && header->filetype != MH_DYLIB) continue;

    // Only the app's own images. Rewriting a slot inside a system library would be a very
    // expensive way to corrupt an unrelated process.
    NSString *path = @(_dyld_get_image_name(i));
    if (![path hasPrefix:bundle]) continue;

    if ((const void *)header == replacement.base) continue;

    rebound += rebindImage(header, _dyld_get_image_vmaddr_slide(i), replacement);
  }

  return rebound;
}

const void *HotswapImageBase(const char *path) {
  // dlsym cannot be trusted to find the image's own header, so the image is located by name.
  // Both sides go through realpath first: a temporary file lives under /var, and dyld records
  // it as /private/var.
  char wanted[PATH_MAX];
  if (realpath(path, wanted) == nullptr) return nullptr;

  for (uint32_t i = 0; i < _dyld_image_count(); i++) {
    const char *name = _dyld_get_image_name(i);
    if (name == nullptr) continue;

    char resolved[PATH_MAX];
    if (realpath(name, resolved) == nullptr) continue;
    if (strcmp(resolved, wanted) == 0) return _dyld_get_image_header(i);
  }

  return nullptr;
}

bool HotswapHasReplacements(const char *path) {
  auto *header = (const mach_header_64 *)HotswapImageBase(path);
  if (header == nullptr) return false;
  auto *command = (const load_command *)((uintptr_t)header + sizeof(mach_header_64));

  for (uint32_t i = 0; i < header->ncmds; i++) {
    if (command->cmd == LC_SEGMENT_64) {
      auto *segment = (const segment_command_64 *)command;
      auto *section = (const section_64 *)((uintptr_t)segment + sizeof(segment_command_64));

      for (uint32_t j = 0; j < segment->nsects; j++, section++) {
        // sectname is a fixed 16-byte field and "__swift5_replace" fills it exactly, so
        // strcmp would run past the end into segname.
        if (strncmp(section->sectname, "__swift5_replace", sizeof(section->sectname)) == 0) {
          return true;
        }
      }
    }

    command = (const load_command *)((uintptr_t)command + command->cmdsize);
  }

  return false;
}
