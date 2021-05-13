task :assignment_fork_fix => :environment do
  Assignment.all.each do |assignment|

    next if assignment.nil? || (assignment.status == "open")

    assignment.with_lock do
      next if assignment.nil? || (assignment.status == "open")

      if assignment.updated_at - Time.new(2021, 04, 16) > 0 # Only check assignments updated after the commit

        if assignment.status == "closed"
          assignment.projects.each do |proj|
            next if proj.forked_project.nil?
            proj.build_project_datum.data = proj.forked_project.project_datum&.data
            proj.save!
          end
        end

      end
    end
  end
end