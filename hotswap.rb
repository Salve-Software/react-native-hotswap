# Adds the linker flag Swift replacement needs, to debug only.
#
# Without -interposable the compiler emits direct calls, and a reloaded function has no way
# to take over an existing call site. A podspec cannot reach the app target, so this runs
# from the Podfile.
def hotswap_post_install(installer)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      next unless config.name.downcase.include?('debug')

      flags = config.build_settings['OTHER_LDFLAGS'] || ['$(inherited)']
      flags = [flags] if flags.is_a?(String)
      next if flags.include?('-interposable')

      config.build_settings['OTHER_LDFLAGS'] = flags + ['-Xlinker', '-interposable']
    end
  end
end
