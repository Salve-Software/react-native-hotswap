#import <Foundation/Foundation.h>
#import <mach-o/dyld.h>
#import <mach/vm_prot.h>
#import <sys/mman.h>
#import <limits.h>
#import <stdlib.h>
#import <string.h>
#import <unistd.h>

#import "HotswapImage.h"

bool HotswapFindImage(const char *path, HotswapImage &into) {
  // Both sides go through realpath first: a temporary file lives under /var, and dyld
  // records it as /private/var.
  char wanted[PATH_MAX];
  if (realpath(path, wanted) == nullptr) return false;

  for (uint32_t i = 0; i < _dyld_image_count(); i++) {
    const char *name = _dyld_get_image_name(i);
    if (name == nullptr) continue;

    char resolved[PATH_MAX];
    if (realpath(name, resolved) == nullptr) continue;
    if (strcmp(resolved, wanted) != 0) continue;

    into.header = (const mach_header_64 *)_dyld_get_image_header(i);
    into.slide = _dyld_get_image_vmaddr_slide(i);

    return true;
  }

  return false;
}

bool HotswapReadSymbols(const HotswapImage &image, HotswapSymbols &into) {
  const symtab_command *symtab = nullptr;
  const dysymtab_command *dysymtab = nullptr;
  intptr_t linkedit = 0;

  auto *command = (const load_command *)((uintptr_t)image.header + sizeof(mach_header_64));

  for (uint32_t i = 0; i < image.header->ncmds; i++) {
    if (command->cmd == LC_SEGMENT_64) {
      auto *segment = (const segment_command_64 *)command;
      if (strcmp(segment->segname, SEG_LINKEDIT) == 0) {
        linkedit = image.slide + segment->vmaddr - segment->fileoff;
      }
    } else if (command->cmd == LC_SYMTAB) {
      symtab = (const symtab_command *)command;
    } else if (command->cmd == LC_DYSYMTAB) {
      dysymtab = (const dysymtab_command *)command;
    }

    command = (const load_command *)((uintptr_t)command + command->cmdsize);
  }

  if (symtab == nullptr || linkedit == 0) return false;

  into.entries = (const nlist_64 *)(linkedit + symtab->symoff);
  into.count = symtab->nsyms;
  into.strings = (const char *)(linkedit + symtab->stroff);
  into.indirect =
      dysymtab == nullptr ? nullptr : (const uint32_t *)(linkedit + dysymtab->indirectsymoff);

  return true;
}

void HotswapEachAppImage(const mach_header_64 *except, void (^body)(const HotswapImage &)) {
  NSString *bundle = NSBundle.mainBundle.bundlePath;

  for (uint32_t i = 0; i < _dyld_image_count(); i++) {
    auto *header = (const mach_header_64 *)_dyld_get_image_header(i);
    if (header == nullptr || header->magic != MH_MAGIC_64 || header == except) continue;
    if (header->filetype != MH_EXECUTE && header->filetype != MH_DYLIB) continue;

    // Only the app's own images. Rewriting a slot inside a system library would be a very
    // expensive way to corrupt an unrelated process.
    const char *name = _dyld_get_image_name(i);
    if (name == nullptr || ![@(name) hasPrefix:bundle]) continue;

    body(HotswapImage{header, _dyld_get_image_vmaddr_slide(i)});
  }
}

void HotswapEachDataSection(const HotswapImage &image, void (^body)(const section_64 *)) {
  auto *command = (const load_command *)((uintptr_t)image.header + sizeof(mach_header_64));

  for (uint32_t i = 0; i < image.header->ncmds; i++) {
    if (command->cmd == LC_SEGMENT_64) {
      auto *segment = (const segment_command_64 *)command;

      if (strcmp(segment->segname, SEG_DATA) == 0 ||
          strcmp(segment->segname, "__DATA_CONST") == 0) {
        auto *section = (const section_64 *)((uintptr_t)segment + sizeof(segment_command_64));

        for (uint32_t j = 0; j < segment->nsects; j++, section++) {
          if ((section->flags & SECTION_TYPE) == S_ZEROFILL) continue;

          body(section);
        }
      }
    }

    command = (const load_command *)((uintptr_t)command + command->cmdsize);
  }
}

bool HotswapMakeWritable(void *address, size_t size) {
  const size_t page = (size_t)getpagesize();
  auto start = (uintptr_t)address & ~(page - 1);
  const size_t span = ((uintptr_t)address + size) - start;

  return mprotect((void *)start, span, PROT_READ | PROT_WRITE) == 0;
}

const char *HotswapDefinedName(const HotswapSymbols &symbols, const nlist_64 &symbol) {
  if (symbol.n_type & N_STAB) return nullptr;
  if ((symbol.n_type & N_TYPE) != N_SECT) return nullptr;

  const char *name = symbols.strings + symbol.n_un.n_strx;

  return name != nullptr && name[0] != '\0' ? name : nullptr;
}

bool HotswapIsCode(const HotswapImage &image, const nlist_64 &symbol) {
  if (symbol.n_sect == NO_SECT) return false;

  auto *command = (const load_command *)((uintptr_t)image.header + sizeof(mach_header_64));
  uint8_t index = 0;

  for (uint32_t i = 0; i < image.header->ncmds; i++) {
    if (command->cmd == LC_SEGMENT_64) {
      auto *segment = (const segment_command_64 *)command;

      // Sections are numbered from one across every segment in order, so the segment that
      // owns a section is only known by counting up to it.
      if (symbol.n_sect <= index + segment->nsects) {
        return (segment->initprot & VM_PROT_EXECUTE) != 0;
      }

      index += segment->nsects;
    }

    command = (const load_command *)((uintptr_t)command + command->cmdsize);
  }

  return false;
}
