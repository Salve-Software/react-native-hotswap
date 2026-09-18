# Adds the linker flag Swift replacement needs, to debug only.
#
# Without -interposable the compiler emits direct calls, and a reloaded function has no way to
# take over an existing call site. The flag matters on the binary that does the final link,
# which is the app target in the user's own project, not the pods.
def hotswap_post_install(installer)
  projects = [installer.pods_project] + installer.aggregate_targets.map(&:user_project)

  projects.compact.uniq.each do |project|
    project.targets.each do |target|
      target.build_configurations.each do |config|
        next unless config.name.downcase.include?('debug')

        flags = config.build_settings['OTHER_LDFLAGS'] || ['$(inherited)']
        flags = [flags] if flags.is_a?(String)
        next if flags.include?('-interposable')

        config.build_settings['OTHER_LDFLAGS'] = flags + ['-Xlinker', '-interposable']
      end
    end

    project.save
  end
end
